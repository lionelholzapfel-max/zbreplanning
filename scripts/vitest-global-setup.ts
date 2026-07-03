import { seed } from './e2e-seed';

// Re-seed the TEST database before the vitest suite so fixture drift can't
// silently break the integration tests again (see AGENTS.md).
export default async function () {
  await seed();
}
