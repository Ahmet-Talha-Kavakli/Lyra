// lib/schemaTherapy.js
// Şema Terapisi — yaşam paternleri ve çocukluk kökleri
// Young modeli, 18 temel şema

const EARLY_MALADAPTIVE_SCHEMAS = {
  abandonment: {
    name: 'Terk Edilme (Abandonment)',
    description: 'Yakın olanlar beni terk edecek',
    roots: ['Ergen ebeveyn', 'Ayrılık', 'Duygusal mesafe'],
  },
  mistrust: {
    name: 'Güvensizlik (Mistrust)',
    description: 'İnsanlar beni incitecek veya aldatacak',
    roots: ['Çocuklukta suistimal', 'Hata yapıldı'],
  },
  deprivation: {
    name: 'Duygusal Yoksunluk',
    description: 'Kimse benim duygularımı anlamıyor',
    roots: ['Soğuk ebeveynler', 'Duygusal ihmal'],
  },
  failure: {
    name: 'Başarısızlık (Failure)',
    description: 'Hiçbir şeyde başarılı olamayacağım',
    roots: ['Yüksek standartlar', 'Aşırı korunma'],
  },
  vulnerability: {
    name: 'Savunmasızlık (Vulnerability)',
    description: 'Hastalık, yaralanma her an olabilir',
    roots: ['Hasta ebeveyn', 'Aile travması'],
  },
  enmeshment: {
    name: 'İç İçelik (Enmeshment)',
    description: 'Ebeveynlerimin hayatının parçasıyım',
    roots: ['Aşırı yakınlık', 'Ebeveynin duygusal ihtiyacı'],
  },
  entitlement: {
    name: 'Hak Görme (Entitlement)',
    description: 'Kurallar bana uygulanmıyor',
    roots: ['Aşırı müsamaha'],
  },
  approval_seeking: {
    name: 'Onay Arama (Approval-Seeking)',
    description: 'Herkesin beni sevmesi lazım',
    roots: ['Şartlı sevgi', 'Performans-tabanlı değer'],
  },
  self_sacrifice: {
    name: 'Kendini Feda (Self-Sacrifice)',
    description: 'Başkalarının mutluluğu benim olandan daha önemli',
    roots: ['Sorumluluk erken verildi'],
  },
};

export function detectActiveSchemas(userMessage = '') {
  const text = userMessage.toLowerCase();
  const detected = [];
  const patterns = {
    abandonment: /terk|yalnız|ayrı|kaybedecek/i,
    failure: /başarısız|yapamıyor|gücüm|yetmemiş/i,
    approval_seeking: /beğenmeli|sevmeli|herkese|hoşlanmalı/i,
    self_sacrifice: /başkası|benim yerine|onlar/i,
    vulnerability: /korkuyorum|endişe|hastalık|ölüm/i,
  };
  for (const [schema, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) detected.push(schema);
  }
  return {
    activeSchemas: detected.slice(0, 3),
    primarySchema: detected[0] || null,
  };
}

export function buildSchemaContext(schemaName = '') {
  if (!schemaName || !EARLY_MALADAPTIVE_SCHEMAS[schemaName]) return '';
  const schema = EARLY_MALADAPTIVE_SCHEMAS[schemaName];
  let context = `[ŞEMA TERAPİSİ — Yaşam Paternleri]\n\n`;
  context += `Şema: ${schema.name}\n`;
  context += `İnanış: "${schema.description}"\n\n`;
  context += `Kökleri:\n`;
  schema.roots.forEach(root => context += `  • ${root}\n`);
  context += `\nDaha Sağlıklı Cevap:\n`;
  context += `  • Şemanın tamamı doğru değil\n`;
  context += `  • Kanıtları kontrol et\n`;
  context += `  • Çocukluk kökenini tanı\n`;
  return context;
}

export function suggestSchemaHealing(schemaName = '') {
  if (!schemaName || !EARLY_MALADAPTIVE_SCHEMAS[schemaName]) return '';
  const schema = EARLY_MALADAPTIVE_SCHEMAS[schemaName];
  let healing = `[ŞEMA İYİLEŞTİRME]\n\n`;
  healing += `1️⃣ TANI: "${schema.description}" bunu söyleyen kim?\n\n`;
  healing += `2️⃣ SORGU: Bugün hala doğru mu?\n`;
  healing += `  • Başarılı olduğum zamanlar?\n`;
  healing += `  • Beni sevenlerin kanıtı?\n\n`;
  healing += `3️⃣ YENİ İNANIŞ: "Ben yeterli sayılabilirim"\n`;
  return healing;
}
