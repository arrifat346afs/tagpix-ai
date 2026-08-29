/**
 * Category Matcher Utility
 * Matches metadata (title, keywords, description) to stock photo categories
 */

// Adobe Stock categories with their IDs
export const ADOBE_STOCK_CATEGORIES = {
  '1': 'Animals',
  '2': 'Buildings',
  '3': 'Business',
  '4': 'Drinks',
  '5': 'Environment',
  '6': 'Mind',
  '7': 'Food',
  '8': 'Graphic',
  '9': 'Hobby',
  '10': 'Industry',
  '11': 'Landscape',
  '12': 'Lifestyle',
  '13': 'People',
  '14': 'Plant',
  '15': 'Culture',
  '16': 'Science',
  '17': 'Social',
  '18': 'Sport',
  '19': 'Technology',
  '20': 'Transport',
  '21': 'Travel',
};

// ShutterStock categories
export const SHUTTERSTOCK_CATEGORIES = [
  'Abstract',
  'Animals/Wildlife',
  'Arts',
  'Backgrounds/Textures',
  'Beauty/Fashion',
  'Buildings/Landmarks',
  'Business/Finance',
  'Celebrities',
  'Education',
  'Food and drink',
  'Healthcare/Medical',
  'Holidays',
  'Industrial',
  'Interiors',
  'Miscellaneous',
  'Nature',
  'Objects',
  'Parks/Outdoor',
  'People',
  'Religion',
  'Science',
  'Signs/Symbols',
  'Sports/Recreation',
  'Technology',
  'Transportation',
  'Vintage',
];

// Keyword mappings for Adobe Stock categories
const ADOBE_KEYWORDS_MAP: Record<string, string[]> = {
  '1': ['animal', 'pet', 'dog', 'cat', 'bird', 'wildlife', 'zoo', 'mammal', 'fish', 'insect', 'horse', 'cow', 'sheep'],
  '2': ['building', 'architecture', 'house', 'skyscraper', 'tower', 'structure', 'construction', 'bridge', 'monument', 'landmark'],
  '3': ['business', 'office', 'work', 'corporate', 'meeting', 'professional', 'finance', 'economy', 'entrepreneur', 'startup'],
  '4': ['drink', 'beverage', 'coffee', 'tea', 'juice', 'water', 'alcohol', 'wine', 'beer', 'cocktail', 'soda'],
  '5': ['environment', 'nature', 'ecology', 'green', 'sustainable', 'climate', 'conservation', 'pollution', 'renewable'],
  '6': ['mind', 'mental', 'psychology', 'brain', 'thought', 'meditation', 'mindfulness', 'consciousness', 'cognitive'],
  '7': ['food', 'meal', 'cuisine', 'cooking', 'restaurant', 'dish', 'recipe', 'ingredient', 'breakfast', 'lunch', 'dinner'],
  '8': ['graphic', 'design', 'art', 'illustration', 'pattern', 'abstract', 'creative', 'digital', 'visual'],
  '9': ['hobby', 'leisure', 'recreation', 'pastime', 'craft', 'diy', 'collection', 'interest'],
  '10': ['industry', 'factory', 'manufacturing', 'production', 'industrial', 'machinery', 'warehouse', 'assembly'],
  '11': ['landscape', 'scenery', 'mountain', 'valley', 'hill', 'countryside', 'vista', 'panorama', 'terrain'],
  '12': ['lifestyle', 'living', 'daily', 'routine', 'home', 'family', 'modern', 'urban', 'suburban'],
  '13': ['people', 'person', 'human', 'man', 'woman', 'child', 'group', 'crowd', 'portrait', 'face'],
  '14': ['plant', 'flower', 'tree', 'garden', 'botanical', 'leaf', 'vegetation', 'flora', 'bloom'],
  '15': ['culture', 'tradition', 'heritage', 'ethnic', 'cultural', 'festival', 'ceremony', 'custom'],
  '16': ['science', 'research', 'laboratory', 'experiment', 'scientific', 'technology', 'discovery', 'study'],
  '17': ['social', 'community', 'society', 'interaction', 'communication', 'network', 'relationship'],
  '18': ['sport', 'athletic', 'fitness', 'exercise', 'game', 'competition', 'training', 'gym', 'workout'],
  '19': ['technology', 'tech', 'digital', 'computer', 'software', 'innovation', 'electronic', 'device', 'internet'],
  '20': ['transport', 'transportation', 'vehicle', 'car', 'bus', 'train', 'plane', 'ship', 'travel', 'traffic'],
  '21': ['travel', 'tourism', 'vacation', 'trip', 'journey', 'destination', 'tourist', 'adventure', 'explore'],
};

// Keyword mappings for ShutterStock categories
const SHUTTERSTOCK_KEYWORDS_MAP: Record<string, string[]> = {
  'Abstract': ['abstract', 'pattern', 'geometric', 'shape', 'texture', 'background', 'artistic', 'conceptual'],
  'Animals/Wildlife': ['animal', 'wildlife', 'pet', 'dog', 'cat', 'bird', 'mammal', 'fish', 'insect', 'zoo', 'safari'],
  'Arts': ['art', 'artistic', 'painting', 'sculpture', 'gallery', 'museum', 'creative', 'artwork', 'canvas'],
  'Backgrounds/Textures': ['background', 'texture', 'pattern', 'surface', 'material', 'wallpaper', 'backdrop'],
  'Beauty/Fashion': ['beauty', 'fashion', 'style', 'makeup', 'cosmetic', 'model', 'glamour', 'elegant', 'trendy'],
  'Buildings/Landmarks': ['building', 'landmark', 'architecture', 'monument', 'structure', 'tower', 'bridge', 'historic'],
  'Business/Finance': ['business', 'finance', 'corporate', 'office', 'money', 'investment', 'economy', 'professional'],
  'Celebrities': ['celebrity', 'famous', 'star', 'actor', 'actress', 'singer', 'performer'],
  'Education': ['education', 'school', 'learning', 'student', 'teacher', 'classroom', 'study', 'academic'],
  'Food and drink': ['food', 'drink', 'meal', 'cuisine', 'beverage', 'cooking', 'restaurant', 'dish', 'recipe'],
  'Healthcare/Medical': ['health', 'medical', 'healthcare', 'doctor', 'hospital', 'medicine', 'patient', 'treatment'],
  'Holidays': ['holiday', 'celebration', 'festival', 'christmas', 'halloween', 'easter', 'vacation', 'party'],
  'Industrial': ['industrial', 'factory', 'manufacturing', 'production', 'machinery', 'warehouse', 'assembly'],
  'Interiors': ['interior', 'indoor', 'room', 'furniture', 'decor', 'home', 'design', 'living'],
  'Miscellaneous': ['miscellaneous', 'various', 'diverse', 'mixed', 'assorted'],
  'Nature': ['nature', 'natural', 'outdoor', 'environment', 'landscape', 'scenery', 'wilderness', 'forest'],
  'Objects': ['object', 'item', 'thing', 'product', 'tool', 'equipment', 'device'],
  'Parks/Outdoor': ['park', 'outdoor', 'garden', 'playground', 'recreation', 'nature', 'green space'],
  'People': ['people', 'person', 'human', 'man', 'woman', 'child', 'group', 'crowd', 'portrait'],
  'Religion': ['religion', 'religious', 'spiritual', 'church', 'temple', 'faith', 'worship', 'prayer'],
  'Science': ['science', 'scientific', 'research', 'laboratory', 'experiment', 'discovery', 'study'],
  'Signs/Symbols': ['sign', 'symbol', 'icon', 'logo', 'emblem', 'badge', 'mark', 'indicator'],
  'Sports/Recreation': ['sport', 'sports', 'athletic', 'fitness', 'exercise', 'game', 'competition', 'recreation'],
  'Technology': ['technology', 'tech', 'digital', 'computer', 'software', 'electronic', 'device', 'innovation'],
  'Transportation': ['transportation', 'transport', 'vehicle', 'car', 'bus', 'train', 'plane', 'ship', 'traffic'],
  'Vintage': ['vintage', 'retro', 'old', 'antique', 'classic', 'nostalgic', 'historical', 'aged'],
};

/**
 * Calculates a match score between metadata text and category keywords
 */
function calculateMatchScore(text: string, keywords: string[]): number {
  const lowerText = text.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    
    // Exact word match (highest score)
    const wordRegex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
    if (wordRegex.test(lowerText)) {
      score += 10;
    }
    // Partial match (lower score)
    else if (lowerText.includes(lowerKeyword)) {
      score += 5;
    }
  }

  return score;
}

/**
 * Matches metadata to the best Adobe Stock category
 */
export function matchAdobeStockCategory(
  title: string,
  keywords: string,
  description: string
): string {
  const combinedText = `${title} ${keywords} ${description}`;
  let bestMatch = '';
  let bestScore = 0;

  for (const [categoryId, categoryKeywords] of Object.entries(ADOBE_KEYWORDS_MAP)) {
    const score = calculateMatchScore(combinedText, categoryKeywords);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = categoryId;
    }
  }

  return bestMatch;
}

/**
 * Matches metadata to the best ShutterStock category
 */
export function matchShutterStockCategory(
  title: string,
  keywords: string,
  description: string
): string {
  const combinedText = `${title} ${keywords} ${description}`;
  let bestMatch = '';
  let bestScore = 0;

  for (const [categoryName, categoryKeywords] of Object.entries(SHUTTERSTOCK_KEYWORDS_MAP)) {
    const score = calculateMatchScore(combinedText, categoryKeywords);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = categoryName;
    }
  }

  return bestMatch;
}

/**
 * Matches metadata to all categories and returns the best matches
 */
export function matchCategories(
  title: string,
  keywords: string,
  description: string
): {
  adobeStock: string;
  shutterStock1: string;
  shutterStock2: string;
} {
  const adobeStock = matchAdobeStockCategory(title, keywords, description);
  const shutterStock = matchShutterStockCategory(title, keywords, description);

  return {
    adobeStock,
    shutterStock1: shutterStock,
    shutterStock2: shutterStock, // Same category for both ShutterStock selects
  };
}

