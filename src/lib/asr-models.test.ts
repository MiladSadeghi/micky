import assert from 'node:assert/strict'
import test from 'node:test'
import { ASR_MODELS, DEFAULT_ASR_MODEL_ID, getAsrModel, huggingfaceFileUrl } from './asr-models'

test('exposes a default Shenava model that exists in the catalog', () => {
  const model = getAsrModel(DEFAULT_ASR_MODEL_ID)
  assert.ok(model)
  assert.equal(model.isDefault, true)
  assert.equal(ASR_MODELS.some((entry) => entry.id === DEFAULT_ASR_MODEL_ID), true)
})

test('builds Hugging Face resolve URLs for model files', () => {
  const model = getAsrModel(DEFAULT_ASR_MODEL_ID)
  assert.ok(model)
  assert.equal(
    huggingfaceFileUrl(model.repo, model.files[0].name),
    `https://huggingface.co/${model.repo}/resolve/main/${model.files[0].name}`
  )
  assert.equal(getAsrModel('missing-model'), undefined)
})
