import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

/**
 * Two projects, not one shared environment, because this codebase's own
 * pure functions (labels, date formatting, error normalization, the API
 * client factory) are deliberately built with "no Nuxt app context needed"
 * (see app/utils/api-client.ts's module docstring) - running them under the
 * full Nuxt environment would hide that design property instead of proving
 * it, and costs real time (a Nuxt environment boots a virtual app per file).
 * Only tests that genuinely need Nuxt auto-imports/component resolution
 * (component tests, the Pinia store, route middleware) pay that cost.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'happy-dom',
          include: [
            'tests/unit/**/*.spec.ts',
            'tests/services/**/*.spec.ts'
          ]
        }
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: [
            'tests/components/**/*.spec.ts',
            'tests/nuxt/**/*.spec.ts'
          ],
          environment: 'nuxt'
        }
      })
    ]
  }
})
