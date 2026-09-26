// Polish E9 (Part 6 Y39): go to Data & scans and ask for the S14 dialog, exactly as the "Import
// analysis report" command does. Quality and File detail share it.
import { useCityStore } from '../stores/city-store';
import { useEvidenceStore } from '../stores/evidence-store';

export function useImportReport(): () => void {
  const city = useCityStore();
  const evidence = useEvidenceStore();
  return () => { city.navigate('sources'); evidence.requestImport(); };
}
