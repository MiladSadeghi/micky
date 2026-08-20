export type AsrModelFile = {
  name: string
  bytes: number
  sha256: string
}

export type AsrModelDefinition = {
  id: string
  label: string
  description: string
  systemHint: string
  params: string
  isDefault: boolean
  cardUrl: string
  repo: string
  files: AsrModelFile[]
}

export const ASR_MODELS: AsrModelDefinition[] = [
  {
    id: 'shenava-koochik-v1.0-int8',
    label: 'شنوا کوچیک',
    description: 'دقیق‌تر',
    systemHint: 'برای بیشتر کامپیوترهای امروزی',
    params: '114M',
    isDefault: true,
    cardUrl: 'https://huggingface.co/Reza2kn/Shenava-Koochik-v1.0',
    repo: 'mah92/sherpa-onnx-nemo-ctc-fa-shenava-koochik-v1.0-streaming-int8-2026-06-26',
    files: [
      {
        name: 'model.int8.onnx',
        bytes: 132_048_387,
        sha256: '439983c95ab83c55c841e0795ba3a61d56718ec5c972a3a208548b93470b04b1'
      },
      {
        name: 'tokens.txt',
        bytes: 12_236,
        sha256: '8e192963f6e666dfa5721e5cbd4710bc1ef592460a45f08cefc94b2db16a6954'
      }
    ]
  },
  {
    id: 'shenava-rizeh-v1.0-int8',
    label: 'شنوا ریزه',
    description: 'سبک و سریع',
    systemHint: 'برای سیستم‌های قدیمی‌تر یا کم‌قدرت‌تر',
    params: '32M',
    isDefault: false,
    cardUrl: 'https://huggingface.co/Reza2kn/Shenava-Rizeh-v1.0',
    repo: 'mah92/sherpa-onnx-nemo-ctc-fa-shenava-rizeh-v1.0-streaming-int8-2026-06-26',
    files: [
      {
        name: 'model.int8.onnx',
        bytes: 38_335_664,
        sha256: '889a4fdfeb25ea0858493294842d36c637acf391f7f49f6e98881709a468b6bc'
      },
      {
        name: 'tokens.txt',
        bytes: 12_236,
        sha256: '8e192963f6e666dfa5721e5cbd4710bc1ef592460a45f08cefc94b2db16a6954'
      }
    ]
  }
]

export const DEFAULT_ASR_MODEL_ID =
  ASR_MODELS.find((model) => model.isDefault)?.id ?? ASR_MODELS[0].id

export function getAsrModel(id: string): AsrModelDefinition | undefined {
  return ASR_MODELS.find((model) => model.id === id)
}

export function getAsrModelBytes(model: AsrModelDefinition): number {
  return model.files.reduce((total, file) => total + file.bytes, 0)
}

export function huggingfaceFileUrl(repo: string, fileName: string): string {
  return `https://huggingface.co/${repo}/resolve/main/${fileName}`
}
