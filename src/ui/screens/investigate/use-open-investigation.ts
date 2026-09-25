// WP-04 Task 15 (IN5, IN41; IP20, IP34): the ONE entry point into Investigate. Quality's
// review dialog, File detail's finding rows, the city inspector's Findings panel and
// Architecture's cycle and fallow boundary rows all call this composable's returned
// function instead of touching the investigation and city stores separately — so every
// entry point opens the same fingerprint on the investigation store, then navigates,
// and none of them can drift into a slightly different order or forget one of the two
// steps. IP20: Investigate never changes the city selection, and neither does this —
// there is no call to `city.select` here, only `navigate`. The Investigate screen's own
// paging and filter-reset (Task 11, IPF7) reacts to the store's `selectedFingerprint`
// change, so this never duplicates that logic either.
import { useCityStore } from '../../stores/city-store';
import { useInvestigationStore } from '../../stores/investigation-store';

export function useOpenInvestigation(): (fingerprint: string) => void {
  const investigation = useInvestigationStore();
  const city = useCityStore();
  return (fingerprint: string): void => {
    investigation.open(fingerprint);
    city.navigate('investigate');
  };
}
