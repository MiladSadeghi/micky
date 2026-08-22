import assert from 'node:assert/strict'
import test from 'node:test'
import { OpenAiCompatibleLlmProvider, normalizeLlmBaseUrl } from './openai-compatible'

test('normalizes OpenAI-compatible base URLs', () => {
  assert.equal(normalizeLlmBaseUrl(' http://localhost:11434/v1/ '), 'http://localhost:11434/v1')
  assert.throws(() => normalizeLlmBaseUrl('file:///tmp/models'), {
    message: 'آدرس سرور باید با http یا https شروع شود.'
  })
  assert.throws(() => normalizeLlmBaseUrl('not a url'), { message: 'آدرس سرور معتبر نیست.' })
})

test('discovers models from an OpenAI-compatible endpoint with an optional key', async () => {
  const provider = new OpenAiCompatibleLlmProvider({
    id: 'custom',
    label: 'سفارشی',
    getBaseUrl: () => 'https://llm.example/v1/',
    getApiKey: () => 'secret',
    fetch: async (input, init) => {
      assert.equal(input, 'https://llm.example/v1/models')
      assert.deepEqual(init?.headers, { Authorization: 'Bearer secret' })
      return new Response(
        JSON.stringify({
          data: [
            { id: 'model-a', supported_parameters: ['reasoning'] },
            { id: 'model-a' },
            { id: 'model-b' }
          ]
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }
  })

  const models = await provider.listModels()
  assert.deepEqual(
    models.map((model) => model.id),
    ['model-a', 'model-b']
  )
  assert.equal(models[0]?.supportsReasoning, true)
  assert.equal(models[1]?.supportsReasoning, undefined)
})
