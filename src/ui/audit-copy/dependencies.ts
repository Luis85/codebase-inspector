// Part 3 §2: Dependencies screen and the Package detail dialog.
export const DEPS_EYEBROW = 'Audit / Dependencies';
export const DEPS_TITLE = 'Know what your code depends on.';
export const DEPS_SUBTITLE = 'Separate internal coupling from the external packages in your supply chain.';
export const DEPS_EXPORT = 'Export inventory';
export const DEPS_CSV_FILENAME = 'sample-package-inventory.csv';
export const DEPS_CALLOUT_TITLE = 'Fictional packages, real review flow.';
export const DEPS_CALLOUT = 'Every @sample package, version and advisory is demonstration data, not a claim about published software or about your codebase.';
export const DEPS_MANIFESTS_TITLE = 'Manifests found';
export const DEPS_MANIFESTS_NOTE = 'Contents not read. A real package inventory arrives with a dependency provider.';
export const DEPS_MANIFESTS_NONE = 'No package.json in this inventory.';
export const DEPS_CARD_PACKAGES = 'Packages in fixture';
export const DEPS_CARD_PACKAGES_CAPTION = (direct: number, transitive: number, dev: number): string => `${direct} direct · ${transitive} transitive · ${dev} development`;
export const DEPS_CARD_ADVISORIES = 'Advisories to review';
export const DEPS_CARD_ADVISORIES_CAPTION = 'Reachability not established';
export const DEPS_CARD_UNUSED = 'Unused candidates';
export const DEPS_CARD_UNUSED_CAPTION = 'Verify entry points before removal';
export const DEPS_CARD_LICENSE = 'License unknown';
export const DEPS_CARD_LICENSE_CAPTION = 'Unresolved does not mean incompatible';
export const DEPS_TABS_LABEL = 'Dependency views';
export const DEPS_TAB_INVENTORY = 'Package inventory';
export const DEPS_TAB_PATH = 'Dependency path';
export const DEPS_TAB_LICENSES = 'Licenses';
export const DEPS_FILTER_QUERY = 'Find a package…';
export const DEPS_FILTER_LABEL = 'Relationship or status';
export const DEPS_FILTER_LABELS: Readonly<Record<'all' | 'direct' | 'transitive' | 'development' | 'review' | 'unused', string>> = {
  all: 'All dependencies', direct: 'Direct', transitive: 'Transitive', development: 'Development', review: 'Review', unused: 'Unused',
};
export const DEPS_TABLE_CAPTION = 'Sample package inventory';
export const DEPS_COL_PACKAGE = 'Package';
export const DEPS_COL_INSTALLED = 'Installed';
export const DEPS_COL_RELATIONSHIP = 'Relationship';
export const DEPS_COL_LICENSE = 'License';
export const DEPS_COL_STATUS = 'Status';
export const DEPS_REFERENCES = (n: string): string => `${n} illustrative import references`;
export const DEPS_RELATIONSHIP_LABEL: Readonly<Record<'direct' | 'transitive' | 'development', string>> = {
  direct: 'Direct', transitive: 'Transitive', development: 'Development',
};
export const DEPS_STATUS_LABEL: Readonly<Record<'review' | 'current' | 'update' | 'unused', string>> = {
  review: 'Review', current: 'Current', update: 'Update', unused: 'Unused',
};
export const DEPS_LICENSE_UNRESOLVED = 'Unresolved';
export const DEPS_COUNT = (n: number): string => `${n} packages · names and advisory data are fictional.`;
export const DEPS_NO_MATCH_TITLE = 'No packages found';
export const DEPS_NO_MATCH = 'Try a shorter name or a different relationship filter.';
export const DEPS_PATH_TITLE = 'An external dependency path';
export const DEPS_PATH_SUBTITLE = 'How a transitive package reaches your codebase, in the fixture.';
export const DEPS_PATH_DIRECT = 'Direct dependency';
export const DEPS_PATH_TRANSITIVE = 'Transitive dependency';
export const DEPS_INSPECT = 'Inspect package';
export const DEPS_LICENSES_TITLE = 'License inventory';
export const DEPS_LICENSES_SUBTITLE = 'Policy compatibility needs a project-specific legal review.';
export const DEPS_LICENSES_CAPTION = 'Licences in the sample inventory';
export const DEPS_COL_PACKAGES = 'Packages';
export const DEPS_COL_RECORDED = 'Recorded status';
export const DEPS_RECORDED_OK = 'Recorded';
export const DEPS_RECORDED_REVIEW = 'Needs review';
export const DEPS_FOOTNOTE = 'No network, registry or advisory-database calls are made.';
export const PACKAGE_DIALOG_SUBTITLE = 'Fictional package record, for review-flow illustration only.';
export const PACKAGE_DEMO_BADGE = 'Demo data';
export const PACKAGE_INSTALLED = 'Installed';
export const PACKAGE_TARGET = 'Illustrative target';
export const PACKAGE_REFERENCES = 'References';
export const PACKAGE_ADVISORY_UNKNOWN = 'Reachability and real exposure are unknown. Confirm affected versions and behaviour before upgrading. This is not a real advisory.';
export const PACKAGE_UNUSED_NOTE = 'No references in the fixture. Verify entry points, scripts and configuration before removal.';
export const PACKAGE_METADATA_NOTE = 'Metadata is illustrative. No package registry or real lockfile was consulted.';
export const PACKAGE_CREATE_REVIEW = 'Create review item';
export const PACKAGE_IN_REVIEW = 'Review item exists';
export const PACKAGE_REVIEW_TITLE = (name: string, advisory: string | null): string => `Review ${name} ${advisory ?? 'dependency usage'}`;
export const PACKAGE_REVIEW_ADDED = 'Review item added.';
export const PACKAGE_REVIEW_FAILED = 'Could not add this review item.';
export const PACKAGE_CLOSE = 'Close';
