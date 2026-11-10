// The online demo snapshot's stand-in for the custom-scenario server action (next.config.ts aliases it here
// when MAAL_STATIC=1). A custom scenario rebuilds the business in the Python engine, which a static host
// cannot run, so the page shows a notice instead of the builder and never calls this.
export async function runCustomScenarioForm(): Promise<void> {}
