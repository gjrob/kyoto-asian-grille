// SOURCE: shared/lib/social-content.ts — update both if changing
// Tier 2 Social Media AI Marketing — canonical post generator
// Copy to clients/[slug]/lib/social-content.ts with this header intact

import Anthropic from '@anthropic-ai/sdk'

export interface BrandVoice {
  tone: string
  topics: string[]
  hashtags: string[]
  custom_instructions?: string
}

export interface GeneratedPost {
  content_en: string
  content_es: string
  platform: string
}

export async function generateSocialPost(
  clientSlug: string,
  clientName: string,
  platform: 'facebook' | 'instagram' | 'google_business',
  brandVoice: BrandVoice
): Promise<GeneratedPost> {
  const client = new Anthropic()

  const topicsStr = brandVoice.topics?.length
    ? brandVoice.topics.join(', ')
    : 'local community, daily specials, team highlights'

  const hashtagsStr = brandVoice.hashtags?.length
    ? brandVoice.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    : `#${clientSlug} #WilmingtonNC`

  const platformGuide: Record<string, string> = {
    facebook: 'Write a Facebook post. Can be 1-3 paragraphs. Conversational, community-focused.',
    instagram: 'Write an Instagram caption. Include line breaks for readability. End with relevant hashtags.',
    google_business: 'Write a Google Business update. Keep it under 300 characters. Direct and informative.',
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `You are a social media content creator for ${clientName}, a local business in Wilmington, NC.
Tone: ${brandVoice.tone}.
Topics to cover: ${topicsStr}.
Standard hashtags: ${hashtagsStr}.
${brandVoice.custom_instructions ? `Special instructions: ${brandVoice.custom_instructions}` : ''}

Rules:
- Write for a local Wilmington audience
- Be authentic, not corporate
- Never use placeholder text
- Include a call to action`,
    messages: [
      {
        role: 'user',
        content: `${platformGuide[platform] ?? platformGuide.facebook}

Generate TWO versions:
1. ENGLISH version
2. SPANISH version (natural translation, not robotic)

Format your response exactly as:
===EN===
[English post here]
===ES===
[Spanish post here]`,
      },
    ],
  })

  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''

  const enMatch = text.match(/===EN===([\s\S]*?)===ES===/)
  const esMatch = text.match(/===ES===([\s\S]*)$/)

  const content_en = enMatch ? enMatch[1].trim() : text.trim()
  const content_es = esMatch ? esMatch[1].trim() : ''

  return {
    content_en,
    content_es,
    platform,
  }
}
