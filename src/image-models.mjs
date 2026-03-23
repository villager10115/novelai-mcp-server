export const NAI_IMAGE_MODELS = [
  {
    id: "nai-diffusion-4-5-full",
    label: "NovelAI Diffusion V4.5 Full",
    family: "v4.5",
    type: "general"
  },
  {
    id: "nai-diffusion-4-5-curated",
    label: "NovelAI Diffusion V4.5 Curated",
    family: "v4.5",
    type: "general"
  },
  {
    id: "nai-diffusion-4-full",
    label: "NovelAI Diffusion V4 Full",
    family: "v4",
    type: "general"
  },
  {
    id: "nai-diffusion-4-curated",
    label: "NovelAI Diffusion V4 Curated",
    family: "v4",
    type: "general"
  },
  {
    id: "nai-diffusion-anime-3",
    label: "NovelAI Diffusion Anime V3",
    family: "v3",
    type: "anime"
  },
  {
    id: "nai-diffusion-furry-3",
    label: "NovelAI Diffusion Furry V3",
    family: "v3",
    type: "furry"
  }
];

export const NAI_IMAGE_MODEL_IDS = NAI_IMAGE_MODELS.map((m) => m.id);