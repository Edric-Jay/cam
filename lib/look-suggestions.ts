// Editorial subject suggestions based on look names, not vendor specifications.
const suggestions: [RegExp, string][] = [
  [/food|pastry|mango/i, 'Food and café photography'],
  [/fashion|stylish/i, 'Fashion and editorial portraits'],
  [/honeymoon|amore/i, 'Couples and lifestyle portraits'],
  [/portrait|portra|astia/i, 'Portraits and natural skin tones'],
  [/night|midnight|twilight|neopan/i, 'Night streets and low-light scenes'],
  [/forest|lush|valley|landscape|scenery|summit|birds eye|velvia|vivid sky/i, 'Landscapes and outdoor adventures'],
  [/coast|beach|sea breeze|lagoon|malibu|coconut|cali/i, 'Beach days and coastal travel'],
  [/street|city|brooklyn|concrete|binary|kyoto/i, 'Street photography and city life'],
  [/classic ride|road|renegade|top gun/i, 'Cars and road-trip stories'],
  [/travel|nomad|passport|explor|escape|free spirit|wide angle/i, 'Travel stories and everyday adventures'],
  [/moody|mood|rainy|mist|shades/i, 'Atmospheric scenes and moody travel'],
  [/cin[eé]|movie|hollywood|filmmaker|filmic/i, 'Cinematic scenes and visual storytelling'],
  [/gold|amber|warm|copper|desert|tumbleweed/i, 'Golden-hour portraits and warm landscapes'],
  [/arctic|snow|cool/i, 'Winter landscapes and cool-toned scenes'],
  [/pastel|soft|fade/i, 'Soft portraits and quiet everyday moments'],
  [/vintage|flashback|classic film|film roll|instant|polaroid|disposable|lomography/i, 'Retro snapshots and candid moments'],
  [/bright|hdr|rich color|vibrant|flat pop|ultra/i, 'Colorful scenes and bold details'],
  [/summer|daybreak|good vibes|vibe|chillen|luminous/i, 'Daylight scenes and relaxed lifestyle'],
  [/film|kodak|kodachrome|ekta|agfa|agf|fuj|kdk|color|reversal/i, 'Film-inspired travel and everyday photos'],
];

export function bestForLook(name: string): string {
  return suggestions.find(([pattern])=>pattern.test(name))?.[1] ?? 'Everyday moments and lifestyle photography';
}
