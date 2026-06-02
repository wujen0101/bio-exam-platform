// 生物學課程單元清單與歷年考古題出題比率
// 資料來源：112年 學士後醫暨後中醫 生物學考題分析（7校綜合統計）

export const UNITS = [
  {
    id: 'unit1',
    name: 'Unit 1',
    title: 'Cell Biology',
    title_zh: '細胞生物學',
    exam_ratio: 0.10, // 10%
    chapters: [
      { no: 1, en: 'Cell Structure and Function', zh: '細胞的構造和功能' },
      { no: 2, en: 'Cell Membrane',               zh: '細胞膜' },
      { no: 3, en: 'Cell Signaling',               zh: '細胞訊號傳遞' },
    ],
  },
  {
    id: 'unit2',
    name: 'Unit 2',
    title: 'Animal Organization and Physiology',
    title_zh: '動物構造和功能',
    exam_ratio: 0.21, // 21%
    chapters: [
      { no: 4,  en: 'Body Structure and Function',  zh: '身體構造和功能' },
      { no: 5,  en: 'Neurons and Synapses',         zh: '神經和突觸' },
      { no: 6,  en: 'Nervous System',               zh: '神經系統' },
      { no: 7,  en: 'Sensory Physiology',           zh: '感覺' },
      { no: 8,  en: 'Movement in Animals',          zh: '運動' },
      { no: 9,  en: 'Animal Transport Systems',     zh: '動物的運輸系統' },
      { no: 10, en: 'Hormones and the Endocrine',   zh: '激素和內分泌' },
      { no: 11, en: 'Digestive Systems',            zh: '消化系統' },
      { no: 12, en: 'Excretory Systems',            zh: '排泄系統' },
      { no: 13, en: 'Reproductive Systems',         zh: '生殖系統' },
      { no: 14, en: 'Development in Animal',        zh: '動物發育' },
    ],
  },
  {
    id: 'unit3',
    name: 'Unit 3',
    title: 'Biochemistry',
    title_zh: '巨分子及生物化學',
    exam_ratio: 0.08, // 8%
    chapters: [
      { no: 15, en: 'Biological Macromolecules', zh: '生物巨分子' },
      { no: 16, en: 'Cellular Respiration',      zh: '細胞呼吸' },
    ],
  },
  {
    id: 'unit4',
    name: 'Unit 4',
    title: 'Molecular Biology',
    title_zh: '分子生物學',
    exam_ratio: 0.17, // 17%
    chapters: [
      { no: 17, en: 'Mitosis',                        zh: '有絲分裂' },
      { no: 18, en: 'Meiosis',                        zh: '減數分裂' },
      { no: 19, en: 'Mendelian Genetics',             zh: '孟德爾遺傳學' },
      { no: 20, en: 'Linkage and Chromosomes',        zh: '染色體與連鎖' },
      { no: 21, en: 'Nucleic Acids and Inheritance',  zh: '核甘酸與遺傳' },
      { no: 22, en: 'Expression of Genes',            zh: '基因的表現' },
      { no: 23, en: 'Control of Gene Expression',     zh: '基因表現之控制' },
    ],
  },
  {
    id: 'unit5',
    name: 'Unit 5',
    title: 'Biotechnology',
    title_zh: 'DNA生物科技',
    exam_ratio: 0.04, // 4%
    chapters: [
      { no: 24, en: 'DNA Technology',          zh: 'DNA科技' },
      { no: 25, en: 'The Evolution of Genomes', zh: '基因體的演化' },
    ],
  },
  {
    id: 'unit6',
    name: 'Unit 6',
    title: 'Microbiology and Immunology',
    title_zh: '微生物免疫學',
    exam_ratio: 0.14, // 14%
    chapters: [
      { no: 26, en: 'Defenses Against Infection', zh: '感染之防禦' },
      { no: 27, en: 'Microorganisms',             zh: '微生物' },
    ],
  },
  {
    id: 'unit7',
    name: 'Unit 7',
    title: 'Plant Biology',
    title_zh: '植物生物學',
    exam_ratio: 0.08, // 8%
    chapters: [
      { no: 28, en: 'Plant Structure and Growth',  zh: '植物的構造和生長' },
      { no: 29, en: 'Plant Signals and Behavior',  zh: '植物的訊號和行為' },
      { no: 30, en: 'The Diversity of Plants',     zh: '植物的多樣性' },
    ],
  },
  {
    id: 'unit8',
    name: 'Unit 8',
    title: 'Evolution',
    title_zh: '演化學',
    exam_ratio: 0.11, // 11%
    chapters: [
      { no: 31, en: 'Fungi',                    zh: '真菌' },
      { no: 32, en: 'The Diversity of Animals', zh: '動物的多樣性' },
      { no: 33, en: 'How Evolution Works',      zh: '演化的機制' },
      { no: 34, en: 'The Origin of Species',    zh: '物種的起源' },
    ],
  },
  {
    id: 'unit9',
    name: 'Unit 9',
    title: 'Ecosystems',
    title_zh: '生態學',
    exam_ratio: 0.07, // 7%
    chapters: [
      { no: 35, en: 'An Overview of Ecology',      zh: '生態學概論' },
      { no: 36, en: 'Populations and Life History', zh: '族群和生活史' },
      { no: 37, en: 'Biodiversity and Communities', zh: '生物多樣性和群落' },
      { no: 38, en: 'Ecosystems and Conservation', zh: '生態系及保育' },
    ],
  },
]

// 依 unitId 快速查找
export const UNIT_MAP = Object.fromEntries(UNITS.map(u => [u.id, u]))

// 歷年各校出題比率參考（來源：108–112 各校統計）
// school_ratios 可供學生選擇「以特定目標學校比率」出模擬考
export const SCHOOL_RATIOS = {
  中國後中: { unit1:7, unit2:12, unit3:5,  unit4:16, unit5:4,  unit6:18, unit7:16, unit8:10, unit9:12 },
  慈濟後中: { unit1:7, unit2:12, unit3:5,  unit4:19, unit5:4,  unit6:7,  unit7:22, unit8:16, unit9:8  },
  義守後中: { unit1:7, unit2:40, unit3:5,  unit4:20, unit5:3,  unit6:8,  unit7:7,  unit8:9,  unit9:1  },
  高醫後醫: { unit1:4, unit2:28, unit3:4,  unit4:10, unit5:4,  unit6:8,  unit7:19, unit8:16, unit9:8  },
  清華後醫: { unit1:5, unit2:35, unit3:7,  unit4:13, unit5:5,  unit6:20, unit7:3,  unit8:7,  unit9:5  },
  中興後醫: { unit1:8, unit2:23, unit3:7,  unit4:27, unit5:4,  unit6:7,  unit7:7,  unit8:15, unit9:4  },
  中山後醫: { unit1:10,unit2:29, unit3:11, unit4:17, unit5:5,  unit6:9,  unit7:10, unit8:9,  unit9:1  },
  綜合平均:  { unit1:10,unit2:21, unit3:8,  unit4:17, unit5:4,  unit6:14, unit7:8,  unit8:11, unit9:7  },
}
