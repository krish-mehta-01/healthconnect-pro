import { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchDashboard } from '../store/dashboardSlice';
import { getFacilities, getCycles, getIndicators, getDepartments, submitNewReport, extractOCR } from '../services/api';
import { CheckCircle, ImagePlus } from 'lucide-react';
import { canSubmitReport } from '../utils/permissions';

interface Props {
  // Called once the report is submitted and the success message has been shown briefly —
  // the Dashboard uses this to switch back to the Overview tab.
  onSuccess?: () => void;
}

export default function SubmitReportForm({ onSuccess }: Props) {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(s => s.auth);

  const [facilities, setFacilities] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const [selectedFacility, setSelectedFacility] = useState('');
  const [selectedCycle, setSelectedCycle] = useState('');
  const [indicatorValues, setIndicatorValues] = useState<Record<string, string>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // OCR-assisted report reading — lets Facility_Staff/Data_Entry_Clerk snap a photo of a
  // paper register and read the scanned values off the extracted text while filling the
  // indicator inputs manually. Deliberately not auto-parsed/auto-filled into fields — see
  // Feature 2 spec: free-form OCR text is not reliable enough to trust for direct entry.
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrText, setOcrText] = useState('');

  useEffect(() => {
    Promise.all([
      getFacilities(),
      getCycles(),
      getIndicators(),
      getDepartments()
    ]).then(([facData, cycleData, indData, deptData]) => {
      setFacilities(facData);
      setCycles(cycleData);
      setIndicators(indData);
      setDepartments(deptData);

      if (facData.length > 0) setSelectedFacility(facData[0].ROWID);
      if (cycleData.length > 0) setSelectedCycle(cycleData[0].ROWID);
    }).catch(err => console.error('Failed to load form data:', err));
  }, []);

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrError('');
    setOcrText('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error || new Error('Could not read the selected file'));
        reader.readAsDataURL(file);
      });
      const result = await extractOCR(base64, file.type);
      setOcrText(result.text || 'No readable text was found in this image.');
    } catch (err) {
      console.error('OCR extraction failed:', err);
      setOcrError(err instanceof Error ? err.message : 'Failed to read the image. Please try again or enter values manually.');
    } finally {
      setOcrLoading(false);
      e.target.value = '';
    }
  };

  const handleIndicatorChange = (id: string, value: string) => {
    setIndicatorValues(prev => ({ ...prev, [id]: value }));
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      const inds = Object.entries(indicatorValues).map(([indicator_id, value]) => ({
        indicator_id,
        value,
        notes: ''
      }));

      await submitNewReport({
        facility_id: selectedFacility,
        cycle_id: selectedCycle,
        indicators: inds
      });

      setSubmitSuccess(true);
      setIndicatorValues({});
      dispatch(fetchDashboard()); // Refresh dashboard data
      setTimeout(() => {
        onSuccess?.();
        setSubmitSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Submission failed:', err);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="card-header">
        <h3>Submit New Facility Report</h3>
      </div>
      <div className="card-body" style={{ padding: '2rem' }}>
        {submitSuccess && (
          <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={20} />
            Report submitted successfully! Redirecting...
          </div>
        )}

        <form onSubmit={handleReportSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Facility</label>
              <select
                style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                value={selectedFacility}
                onChange={e => setSelectedFacility(e.target.value)}
                required
              >
                <option value="">Select Facility...</option>
                {facilities.map(f => (
                  <option key={f.ROWID} value={f.ROWID}>{f.Facility_Name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Reporting Cycle</label>
              <select
                style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                value={selectedCycle}
                onChange={e => setSelectedCycle(e.target.value)}
                required
              >
                <option value="">Select Cycle...</option>
                {cycles.map(c => (
                  <option key={c.ROWID} value={c.ROWID}>{c.Cycle_Name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* OCR-assisted report reading — read scanned values off the extracted text
              while filling indicators manually below. Not auto-filled into fields. */}
          {canSubmitReport(user?.role) && (
            <div style={{ marginBottom: '2rem', padding: '1.25rem', borderRadius: '8px', border: '1px dashed var(--color-border)', background: 'var(--color-bg-secondary)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
                <ImagePlus size={18} /> Upload Photo to Read Values
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleOcrUpload}
                disabled={ocrLoading}
                style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem' }}
              />
              <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Scan a paper register or report photo to read the values off it — enter them into the fields below yourself; values are not auto-filled.
              </p>
              {ocrLoading && (
                <p style={{ marginTop: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Reading image…</p>
              )}
              {ocrError && (
                <p style={{ marginTop: '0.75rem', color: 'var(--color-danger)', fontSize: '0.85rem' }}>{ocrError}</p>
              )}
              {ocrText && (
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>Extracted text:</p>
                  <textarea
                    readOnly
                    value={ocrText}
                    rows={6}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Indicators grouped by Department — as disease-program-specific indicators
              (TB, Polio, etc.) get added alongside general ones, a flat list of every
              indicator in the network stops being scannable per report. */}
          {departments
            .map(dept => ({ dept, deptIndicators: indicators.filter(ind => ind.Dept_ID === dept.ROWID) }))
            .filter(({ deptIndicators }) => deptIndicators.length > 0)
            .map(({ dept, deptIndicators }) => (
              <div key={dept.ROWID} style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>{dept.Dept_Name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                  {deptIndicators.map(ind => (
                    <div key={ind.ROWID} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{ind.Indicator_Name}</label>
                      <input
                        type="number"
                        placeholder="Enter value"
                        style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                        value={indicatorValues[ind.ROWID] || ''}
                        onChange={e => handleIndicatorChange(ind.ROWID, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
          ))}
          {(() => {
            const deptIds = new Set(departments.map(d => d.ROWID));
            const ungrouped = indicators.filter(ind => !deptIds.has(ind.Dept_ID));
            if (ungrouped.length === 0) return null;
            return (
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Other Indicators</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                  {ungrouped.map(ind => (
                    <div key={ind.ROWID} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{ind.Indicator_Name}</label>
                      <input
                        type="number"
                        placeholder="Enter value"
                        style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                        value={indicatorValues[ind.ROWID] || ''}
                        onChange={e => handleIndicatorChange(ind.ROWID, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
