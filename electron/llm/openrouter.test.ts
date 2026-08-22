import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_LLM_MODEL_ID } from '@/lib/llm'
import { OpenRouterProvider } from './openrouter'

test('reads reasoning support from the OpenRouter model catalog', async () => {
  const provider = new OpenRouterProvider({
    getApiKey: () => 'secret',
    fetch: async (_input, init) => {
      assert.deepEqual(init?.headers, { Authorization: 'Bearer secret' })
      return new Response(
        JSON.stringify({
          data: [
            {
              id: DEFAULT_LLM_MODEL_ID,
              architecture: { input_modalities: ['text', 'image'] },
              supported_parameters: ['tools', 'reasoning']
            }
          ]
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }
  })

  const models = await provider.listModels([])
  const model = models.find((candidate) => candidate.id === DEFAULT_LLM_MODEL_ID)
  assert.deepEqual(model?.inputModalities, ['text', 'image'])
  assert.equal(model?.supportsReasoning, true)
})
