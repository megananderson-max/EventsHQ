import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new Database(path.join(__dirname, 'events.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Ensure unique index exists
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_name ON opportunities(name)') } catch {}

const ins = db.prepare(`
  INSERT INTO opportunities (
    name, type, start_date, end_date, location, venue,
    expected_attendees, budget_estimate_low, budget_estimate_high,
    strategic_fit, audience_match, recommendation,
    description, status, generated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pipeline', datetime('now'))
  ON CONFLICT(name) DO UPDATE SET
    start_date=excluded.start_date, end_date=excluded.end_date,
    location=excluded.location, venue=excluded.venue,
    expected_attendees=excluded.expected_attendees,
    budget_estimate_low=excluded.budget_estimate_low,
    budget_estimate_high=excluded.budget_estimate_high,
    strategic_fit=excluded.strategic_fit,
    audience_match=excluded.audience_match,
    recommendation=excluded.recommendation,
    description=excluded.description,
    generated_at=datetime('now')
`)

function seed(o) {
  ins.run(
    o.name, o.type || 'conference',
    o.start_date || null, o.end_date || null,
    o.location || null, o.venue || null,
    o.attendees || null,
    o.low || null, o.high || null,
    o.fit || 'Medium',
    o.audience || null,
    o.rec || 'Evaluate',
    o.desc || null
  )
}

// ══════════════════════════════════════════════════════════════════════
// NORTH AMERICA — AI & Enterprise Tech
// ══════════════════════════════════════════════════════════════════════

seed({
  name: 'AI4 2026',
  type: 'conference',
  start_date: '2026-08-04', end_date: '2026-08-06',
  location: 'Las Vegas, NV, USA', venue: 'MGM Grand',
  attendees: 4000,
  low: 20000, high: 75000,
  fit: 'High',
  audience: 'Enterprise AI decision-makers, CX leaders, digital transformation officers — direct match for Khoros ICP targeting CX automation and AI-powered customer engagement.',
  rec: 'Sponsor',
  desc: 'AI4 is a premier AI conference bringing together enterprise leaders, data scientists, and technology executives. Strong focus on practical AI applications including CX automation, customer service AI, and digital transformation — a prime audience for Khoros AI (Aurora AI, IRIS AI) demos and thought leadership.'
})

seed({
  name: 'The AI Summit New York 2026',
  type: 'conference',
  start_date: '2026-12-09', end_date: '2026-12-10',
  location: 'New York, NY, USA', venue: 'Javits Center',
  attendees: 8000,
  low: 25000, high: 100000,
  fit: 'High',
  audience: 'C-suite AI and digital transformation leaders at Fortune 500 companies — strong overlap with Khoros enterprise CX buyers and community platform decision-makers.',
  rec: 'Sponsor',
  desc: 'World-leading AI business summit covering practical enterprise AI adoption. Features dedicated CX and customer engagement tracks. Large enterprise buyer audience makes this a high-conversion sponsorship opportunity for Khoros.'
})

seed({
  name: 'VentureBeat Transform 2026',
  type: 'conference',
  start_date: '2026-07-14', end_date: '2026-07-15',
  location: 'San Francisco, CA, USA',
  attendees: 1500,
  low: 15000, high: 60000,
  fit: 'High',
  audience: 'Enterprise technology leaders, AI practitioners and VPs of digital transformation — ideal for Khoros Aurora AI/IRIS AI positioning among early enterprise AI adopters.',
  rec: 'Sponsor',
  desc: 'VentureBeat Transform focuses on enterprise AI strategy and implementation. Attracts senior technology decision-makers from large enterprises evaluating AI platforms for customer engagement and operational efficiency.'
})

seed({
  name: 'GAI World 2026',
  type: 'conference',
  start_date: '2026-09-28', end_date: '2026-09-30',
  location: 'Boston, MA, USA',
  attendees: 2500,
  low: 15000, high: 50000,
  fit: 'Medium',
  audience: 'Generative AI practitioners and enterprise AI leaders — useful for positioning Khoros AI capabilities, though less focused on CX specifically.',
  rec: 'Evaluate',
  desc: 'GAI World is a dedicated generative AI conference covering enterprise AI adoption across industries. Good platform for showcasing Khoros Aurora and IRIS AI capabilities to AI-forward enterprise leaders.'
})

seed({
  name: 'HumanX 2026',
  type: 'conference',
  start_date: '2026-04-06', end_date: '2026-04-09',
  location: 'Las Vegas, NV, USA',
  attendees: 3000,
  low: 20000, high: 80000,
  fit: 'High',
  audience: 'Enterprise AI leaders and digital CX decision-makers — strong match for Khoros ICP as this event targets the convergence of AI and human experience.',
  rec: 'Sponsor',
  desc: 'HumanX focuses on the intersection of AI and human experience in enterprise contexts, with strong CX and customer engagement tracks. High relevance for Khoros positioning around AI-augmented customer communities and support.'
})

seed({
  name: 'Salesforce Dreamforce 2026',
  type: 'conference',
  start_date: '2026-09-15', end_date: '2026-09-17',
  location: 'San Francisco, CA, USA', venue: 'Moscone Center',
  attendees: 40000,
  low: 50000, high: 250000,
  fit: 'High',
  audience: 'Enterprise CRM, CX, and customer success leaders — high concentration of Khoros ICP buyers including VP Customer Experience, Head of Community, and Contact Center directors.',
  rec: 'Sponsor',
  desc: "Dreamforce is Salesforce's flagship annual conference — the world's largest software conference. Critical for Khoros given competitive overlap with Salesforce CX products. High-value sponsorship for brand visibility among enterprise CX decision-makers and Salesforce ecosystem partners."
})

seed({
  name: 'Google Cloud Next 2026',
  type: 'conference',
  start_date: '2026-04-22', end_date: '2026-04-24',
  location: 'Las Vegas, NV, USA',
  attendees: 30000,
  low: 30000, high: 150000,
  fit: 'Medium',
  audience: 'Enterprise cloud and digital transformation leaders — partial overlap with Khoros ICP, useful for cloud-native CX positioning and AI partnership visibility.',
  rec: 'Evaluate',
  desc: "Google Cloud Next is Google's flagship cloud conference featuring enterprise AI, data, and digital transformation. Strategic attendance or partnership-level sponsorship could strengthen Khoros/Google Cloud integration story."
})

seed({
  name: 'Databricks Data + AI Summit 2026',
  type: 'conference',
  start_date: '2026-06-15', end_date: '2026-06-18',
  location: 'San Francisco, CA, USA',
  attendees: 12000,
  low: 25000, high: 100000,
  fit: 'Medium',
  audience: 'Data and AI engineers, CDOs and analytics leaders — tangential to Khoros CX audience but valuable for AI/data credibility with technical enterprise buyers.',
  rec: 'Attend',
  desc: 'Premier data and AI conference for practitioners and enterprise data leaders. Less CX-focused than ideal for Khoros, but valuable for brand-building among AI-forward enterprises and positioning Khoros data analytics capabilities.'
})

seed({
  name: 'GenAI Summit SF 2026',
  type: 'conference',
  start_date: '2026-07-18', end_date: '2026-07-19',
  location: 'San Francisco, CA, USA',
  attendees: 2000,
  low: 10000, high: 40000,
  fit: 'Medium',
  audience: 'Generative AI product leaders and enterprise AI practitioners — useful for Khoros AI product positioning, particularly Aurora AI and IRIS AI capabilities.',
  rec: 'Sponsor',
  desc: 'Focused generative AI summit targeting enterprise AI product development and deployment. Good platform for Khoros Aurora AI showcasing and networking with enterprise AI decision-makers in the Bay Area.'
})

seed({
  name: 'Augmented Enterprise Summit 2026',
  type: 'conference',
  start_date: '2026-10-13', end_date: '2026-10-15',
  location: 'Nashville, TN, USA',
  attendees: 1500,
  low: 10000, high: 40000,
  fit: 'Medium',
  audience: 'Enterprise technology leaders exploring AI augmentation — moderate ICP overlap for Khoros digital transformation and AI-powered CX messaging.',
  rec: 'Evaluate',
  desc: 'Enterprise-focused summit on AI augmentation for business operations. Attracts technology leaders evaluating AI platforms for workflow and customer experience enhancement.'
})

seed({
  name: 'Momentum AI New York 2026',
  type: 'conference',
  start_date: '2026-04-27', end_date: '2026-04-28',
  location: 'New York, NY, USA',
  attendees: 1200,
  low: 8000, high: 30000,
  fit: 'Medium',
  audience: 'AI and digital innovation leaders at enterprise companies — useful for Khoros brand awareness among east coast enterprise AI adopters.',
  rec: 'Sponsor',
  desc: 'New York-based enterprise AI conference focusing on practical AI implementation across industries including financial services and media — large concentrations of Khoros potential customers.'
})

seed({
  name: 'ODSC AI Executive Summit (AIX East) 2026',
  type: 'conference',
  start_date: '2026-04-28', end_date: '2026-04-29',
  location: 'Boston, MA, USA',
  attendees: 1000,
  low: 8000, high: 25000,
  fit: 'Medium',
  audience: 'Data science executives and AI leaders — useful for Khoros AI/data credibility positioning with technical enterprise decision-makers.',
  rec: 'Attend',
  desc: 'ODSC AI Executive Summit targets C-suite and VP-level leaders making enterprise AI investment decisions. Smaller, focused event with high networking quality.'
})

seed({
  name: 'Gartner Data & Analytics Summit 2027',
  type: 'conference',
  start_date: '2027-03-08', end_date: '2027-03-10',
  location: 'Orlando, FL, USA',
  attendees: 3500,
  low: 30000, high: 120000,
  fit: 'High',
  audience: 'Enterprise data, analytics, and AI leaders who influence platform buying decisions — high-value ICP overlap for Khoros analytics and AI product positioning.',
  rec: 'Sponsor',
  desc: 'Gartner Data & Analytics Summit is a premier analyst-led event for enterprise technology decision-makers. Gartner Magic Quadrant visibility makes this critical for Khoros competitive positioning against Sprinklr, Salesforce, and Gainsight.'
})

seed({
  name: 'Info-Tech LIVE 2026',
  type: 'conference',
  start_date: '2026-06-09', end_date: '2026-06-11',
  location: 'Las Vegas, NV, USA',
  attendees: 2000,
  low: 15000, high: 50000,
  fit: 'Medium',
  audience: 'IT and enterprise technology leaders — useful for Khoros enterprise software positioning and IT decision-maker outreach.',
  rec: 'Evaluate',
  desc: 'Info-Tech LIVE brings together IT and enterprise technology leaders for analyst-led research and peer networking. Good platform for Khoros enterprise technology positioning.'
})

seed({
  name: 'SXSW 2027',
  type: 'conference',
  start_date: '2027-03-07', end_date: '2027-03-15',
  location: 'Austin, TX, USA',
  attendees: 75000,
  low: 40000, high: 200000,
  fit: 'Medium',
  audience: 'Digital innovation, media, and tech leaders — broad but includes community managers, social media leaders and digital CX innovators relevant to Khoros brand awareness.',
  rec: 'Evaluate',
  desc: 'SXSW is a massive cross-disciplinary tech and culture festival. While broad, it includes dedicated enterprise tech, community, and digital experience tracks. Good for Khoros brand visibility and community manager audience outreach.'
})

seed({
  name: 'CES 2027',
  type: 'conference',
  start_date: '2027-01-06', end_date: '2027-01-09',
  location: 'Las Vegas, NV, USA',
  attendees: 150000,
  low: 50000, high: 300000,
  fit: 'Low',
  audience: 'Consumer electronics and tech industry leaders — limited direct overlap with Khoros enterprise CX ICP, primarily useful for brand visibility.',
  rec: 'Attend',
  desc: 'CES is the world\'s largest consumer technology event. Limited direct relevance for Khoros CX platform, but strategic attendance could support enterprise partnerships and brand visibility at scale.'
})

seed({
  name: 'Enterprise Connect 2027',
  type: 'conference',
  start_date: '2027-03-23', end_date: '2027-03-25',
  location: 'Orlando, FL, USA',
  attendees: 5000,
  low: 25000, high: 100000,
  fit: 'High',
  audience: 'Enterprise communications, contact center, and customer experience leaders — near-perfect ICP match for Khoros digital contact center and customer care solutions.',
  rec: 'Sponsor',
  desc: 'Enterprise Connect is the premier conference for enterprise communications and contact center technology. High concentration of Khoros ICP buyers (Contact Center directors, VP Customer Care) evaluating digital engagement platforms.'
})

seed({
  name: 'Leaders In AI Summit 2026',
  type: 'conference',
  start_date: '2026-06-01', end_date: '2026-06-30',
  location: 'NYC, Boston, Seattle, Austin, San Francisco, USA',
  attendees: 500,
  low: 5000, high: 20000,
  fit: 'Medium',
  audience: 'Senior AI leaders at enterprise companies — intimate format creates high-quality networking for Khoros enterprise sales.',
  rec: 'Sponsor',
  desc: 'Multi-city intimate summit series for AI leaders at enterprise companies. Small format creates high-quality engagement. Good for Khoros enterprise relationship building across major US tech hubs.'
})

seed({
  name: 'ACM AI Leadership Summit 2026',
  type: 'conference',
  start_date: '2026-10-01', end_date: '2026-10-31',
  location: 'USA',
  attendees: 800,
  low: 5000, high: 20000,
  fit: 'Low',
  audience: 'Academic and research AI leaders — limited commercial CX buyer overlap for Khoros.',
  rec: 'Attend',
  desc: 'ACM AI Leadership Summit targets academic and technical AI research leaders. Limited commercial relevance for Khoros CX platform sales, but useful for AI thought leadership credibility.'
})

// ══════════════════════════════════════════════════════════════════════
// CUSTOMER EXPERIENCE & CONTACT CENTER
// ══════════════════════════════════════════════════════════════════════

seed({
  name: 'Customer Contact Week (CCW) 2026',
  type: 'conference',
  start_date: '2026-06-22', end_date: '2026-06-25',
  location: 'Las Vegas, NV, USA',
  attendees: 3500,
  low: 20000, high: 80000,
  fit: 'High',
  audience: 'Contact center VPs, Customer Experience directors, and digital CX leaders — highest concentration of Khoros contact center and digital care ICP buyers.',
  rec: 'Sponsor',
  desc: "CCW is the world's largest customer contact event series. Prime venue for Khoros digital contact center and customer care positioning. Attendees are exactly the decision-makers evaluating Khoros against Genesys, Zendesk, and Five9."
})

seed({
  name: 'Gartner Customer Experience & Technologies Summit 2026',
  type: 'conference',
  start_date: '2026-05-19', end_date: '2026-05-21',
  location: 'Dallas, TX, USA',
  attendees: 2000,
  low: 30000, high: 120000,
  fit: 'High',
  audience: 'Chief Experience Officers, VPs of Customer Experience, and enterprise CX technology leaders — exact Khoros ICP with high purchase authority.',
  rec: 'Sponsor',
  desc: "Gartner's CX summit is where enterprise CX technology buying decisions are made. Critical for Khoros competitive positioning in the Gartner Magic Quadrant context. High ROI for executive-level lead generation."
})

seed({
  name: 'Forrester CX Summit North America 2026',
  type: 'conference',
  start_date: '2026-06-16', end_date: '2026-06-18',
  location: 'Nashville, TN, USA',
  attendees: 2500,
  low: 25000, high: 100000,
  fit: 'High',
  audience: 'Enterprise CX executives and technology decision-makers — strong Khoros ICP match with Forrester Wave context for competitive differentiation.',
  rec: 'Sponsor',
  desc: "Forrester's premier CX event brings together enterprise customer experience leaders guided by Forrester research and Wave reports. Essential for Khoros positioning against Sprinklr, Salesforce, and Higher Logic in analyst-led buying cycles."
})

seed({
  name: 'ICMI Contact Center Expo 2026',
  type: 'conference',
  start_date: '2026-05-05', end_date: '2026-05-08',
  location: 'Orlando, FL, USA',
  attendees: 2000,
  low: 15000, high: 60000,
  fit: 'High',
  audience: 'Contact center managers, directors, and VPs — direct match for Khoros digital contact center and customer care product suite.',
  rec: 'Sponsor',
  desc: 'ICMI Contact Center Expo is a leading conference for contact center professionals. Strong match for Khoros digital contact center capabilities — attendees are evaluating AI-powered customer service platforms.'
})

// ══════════════════════════════════════════════════════════════════════
// COMMUNITY MANAGEMENT
// ══════════════════════════════════════════════════════════════════════

seed({
  name: 'CMX Summit 2026',
  type: 'conference',
  start_date: '2026-09-01', end_date: '2026-09-30',
  location: 'San Francisco, CA, USA',
  attendees: 1200,
  low: 10000, high: 40000,
  fit: 'High',
  audience: 'Community managers, VP Community, and Head of Community professionals — highest-density Khoros community platform ICP audience.',
  rec: 'Sponsor',
  desc: "CMX Summit is THE community management conference. Attendees are Khoros's core community platform buyers and users. Critical for community platform sales, upsell, and brand reinforcement against Higher Logic, Bettermode, and Discourse."
})

seed({
  name: 'Higher Logic Super Forum 2026',
  type: 'conference',
  start_date: '2026-10-01', end_date: '2026-10-31',
  location: 'Washington, DC, USA',
  attendees: 1000,
  low: 15000, high: 50000,
  fit: 'High',
  audience: 'Community and association professionals — direct competitive battleground for Khoros community platform versus Higher Logic.',
  rec: 'Sponsor',
  desc: "Higher Logic's flagship conference is a direct competitive arena for Khoros. Sponsoring or attending enables Khoros to engage prospects actively considering Higher Logic, with opportunities for competitive displacement through thought leadership."
})

// ══════════════════════════════════════════════════════════════════════
// SOCIAL MEDIA & DIGITAL MARKETING
// ══════════════════════════════════════════════════════════════════════

seed({
  name: 'Social Media Marketing World 2027',
  type: 'conference',
  start_date: '2027-03-01', end_date: '2027-03-31',
  location: 'San Diego, CA, USA',
  attendees: 5000,
  low: 20000, high: 80000,
  fit: 'High',
  audience: 'Social media managers, digital marketing leaders, and brand community professionals — strong match for Khoros social media management platform buyers.',
  rec: 'Sponsor',
  desc: 'Social Media Marketing World is the premier social media conference. High concentration of Khoros social media management ICP buyers. Critical for competing against Sprinklr, Hootsuite, and Sprout Social.'
})

seed({
  name: 'MarTech Conference 2026',
  type: 'conference',
  start_date: '2026-09-01', end_date: '2026-09-30',
  location: 'Boston, MA, USA',
  attendees: 3000,
  low: 20000, high: 75000,
  fit: 'High',
  audience: 'Marketing technology leaders, CMOs, and digital marketing directors — strong overlap with Khoros social media management and digital engagement platform buyers.',
  rec: 'Sponsor',
  desc: 'MarTech is the leading conference for marketing technology decision-makers. Strong relevance for Khoros social media management and digital marketing platform positioning against Sprinklr and other MarTech competitors.'
})

// ══════════════════════════════════════════════════════════════════════
// EUROPE
// ══════════════════════════════════════════════════════════════════════

seed({
  name: 'RAISE Summit 2026',
  type: 'conference',
  start_date: '2026-06-04', end_date: '2026-06-05',
  location: 'Paris, France',
  attendees: 5000,
  low: 15000, high: 60000,
  fit: 'Medium',
  audience: 'European AI and enterprise technology leaders — useful for Khoros brand building in European market among AI-forward enterprise buyers.',
  rec: 'Evaluate',
  desc: "RAISE Summit is France's flagship AI event co-organized by the French government. Strong enterprise AI audience with European tech and government leaders. Good for Khoros European market expansion."
})

seed({
  name: 'AI Summit London 2026',
  type: 'conference',
  start_date: '2026-09-10', end_date: '2026-09-11',
  location: 'London, UK',
  attendees: 6000,
  low: 20000, high: 80000,
  fit: 'High',
  audience: 'European enterprise AI and CX leaders — strong ICP match for Khoros UK/Europe market with AI-forward enterprise buyers evaluating CX platforms.',
  rec: 'Sponsor',
  desc: "AI Summit London is Europe's leading enterprise AI conference. High concentration of UK and European enterprise technology buyers. Strategic for Khoros European market expansion alongside the Customer Engagement Summit."
})

seed({
  name: 'World Summit AI 2026',
  type: 'conference',
  start_date: '2026-10-07', end_date: '2026-10-08',
  location: 'Amsterdam, Netherlands',
  attendees: 4000,
  low: 15000, high: 60000,
  fit: 'Medium',
  audience: 'European C-suite AI leaders and enterprise technology buyers — moderate ICP overlap for Khoros European brand building.',
  rec: 'Evaluate',
  desc: 'World Summit AI brings together global AI leaders in Amsterdam. Strong European enterprise tech presence. Useful for Khoros pan-European brand visibility and partnership development.'
})

seed({
  name: 'GITEX Europe Berlin 2026',
  type: 'conference',
  start_date: '2026-05-21', end_date: '2026-05-23',
  location: 'Berlin, Germany',
  attendees: 25000,
  low: 20000, high: 100000,
  fit: 'Medium',
  audience: 'European technology and enterprise digital transformation leaders — broad audience with CX decision-makers among enterprise attendees.',
  rec: 'Evaluate',
  desc: "GITEX Europe is a major technology conference expanding into Europe from its GITEX Dubai roots. Large scale with enterprise tech focus. Useful for Khoros DACH and broader European market presence."
})

seed({
  name: 'VivaTech 2026',
  type: 'conference',
  start_date: '2026-06-11', end_date: '2026-06-14',
  location: 'Paris, France', venue: 'Paris Expo Porte de Versailles',
  attendees: 90000,
  low: 30000, high: 150000,
  fit: 'Low',
  audience: 'Broad tech and startup ecosystem — limited direct CX buyer overlap, primarily useful for European brand visibility.',
  rec: 'Attend',
  desc: "VivaTech is Europe's startup and technology event. Massive scale but broad audience with limited Khoros CX ICP concentration. Strategic attendance could support European partnership development."
})

seed({
  name: 'Web Summit 2026',
  type: 'conference',
  start_date: '2026-11-02', end_date: '2026-11-05',
  location: 'Lisbon, Portugal',
  attendees: 70000,
  low: 30000, high: 150000,
  fit: 'Medium',
  audience: 'Global tech and enterprise leaders — includes community, CX, and digital marketing leaders relevant to Khoros among the broad tech audience.',
  rec: 'Sponsor',
  desc: "Web Summit is one of the world's largest tech conferences. While broad, it includes strong CX and community tracks with senior enterprise decision-makers. Good for Khoros European brand presence and partnership networking."
})

seed({
  name: 'London Tech Week 2026',
  type: 'conference',
  start_date: '2026-06-08', end_date: '2026-06-14',
  location: 'London, UK',
  attendees: 50000,
  low: 15000, high: 80000,
  fit: 'Medium',
  audience: 'UK and European enterprise tech leaders including CX and digital transformation decision-makers relevant to Khoros UK market.',
  rec: 'Sponsor',
  desc: "London Tech Week is the UK's largest technology festival spanning multiple venues and events. Strong for Khoros UK market visibility, especially alongside the Customer Engagement Summit in the same market."
})

seed({
  name: 'AI & Big Data Expo Europe 2026',
  type: 'conference',
  start_date: '2026-06-18', end_date: '2026-06-19',
  location: 'Amsterdam, Netherlands',
  attendees: 6000,
  low: 15000, high: 50000,
  fit: 'Medium',
  audience: 'European enterprise AI and data leaders — useful for Khoros AI product positioning in European market.',
  rec: 'Evaluate',
  desc: 'AI & Big Data Expo Europe covers enterprise AI and data innovation across industries. Good platform for Khoros Aurora AI and IRIS AI capabilities among European enterprise technology buyers.'
})

seed({
  name: 'Slush 2026',
  type: 'conference',
  start_date: '2026-11-19', end_date: '2026-11-20',
  location: 'Helsinki, Finland',
  attendees: 15000,
  low: 15000, high: 60000,
  fit: 'Low',
  audience: 'Startup founders and VC-backed companies — limited enterprise CX buyer overlap for Khoros, more relevant for IgniteTech acquisition sourcing.',
  rec: 'Attend',
  desc: "Slush is Europe's leading startup and tech event. Limited relevance for Khoros CX platform sales, but valuable for IgniteTech deal sourcing and European innovation partnerships."
})

seed({
  name: 'Hannover Messe 2026',
  type: 'conference',
  start_date: '2026-04-22', end_date: '2026-04-26',
  location: 'Hannover, Germany',
  attendees: 130000,
  low: 30000, high: 200000,
  fit: 'Low',
  audience: 'Industrial technology and manufacturing leaders — minimal overlap with Khoros CX enterprise software buyers.',
  rec: 'Attend',
  desc: "Hannover Messe is the world's leading industrial trade show. Very limited relevance for Khoros CX software, included for IgniteTech industrial software portfolio opportunities."
})

// ══════════════════════════════════════════════════════════════════════
// EUROPE — CX SPECIFIC
// ══════════════════════════════════════════════════════════════════════

seed({
  name: 'Customer Experience Live Europe 2026',
  type: 'conference',
  start_date: '2026-09-01', end_date: '2026-09-30',
  location: 'London, UK',
  attendees: 1500,
  low: 15000, high: 50000,
  fit: 'High',
  audience: 'European CX leaders and VP Customer Experience professionals — strong match for Khoros CX platform ICP in the UK/European market.',
  rec: 'Sponsor',
  desc: 'CX Live Europe brings together European customer experience leaders focused on digital CX transformation. High-value audience for Khoros community management and digital contact center sales in the European market.'
})

// ══════════════════════════════════════════════════════════════════════
// ASIA-PACIFIC
// ══════════════════════════════════════════════════════════════════════

seed({
  name: 'SuperAI Singapore 2026',
  type: 'conference',
  start_date: '2026-06-18', end_date: '2026-06-19',
  location: 'Singapore',
  attendees: 5000,
  low: 15000, high: 60000,
  fit: 'Medium',
  audience: 'APAC enterprise AI and technology leaders — useful for Khoros APAC market expansion and AI-forward enterprise buyer engagement.',
  rec: 'Evaluate',
  desc: 'SuperAI is Asia-Pacific\'s premier AI conference held in Singapore. Strong enterprise AI and digital transformation focus. Relevant for Khoros APAC market development and partnership opportunities.'
})

seed({
  name: 'GITEX Global 2026',
  type: 'conference',
  start_date: '2026-10-13', end_date: '2026-10-17',
  location: 'Dubai, UAE', venue: 'Dubai World Trade Centre',
  attendees: 180000,
  low: 30000, high: 200000,
  fit: 'Medium',
  audience: 'Middle East, Africa, and APAC enterprise technology leaders — broad but includes CX and digital transformation decision-makers relevant to Khoros.',
  rec: 'Evaluate',
  desc: 'GITEX Global is the largest technology event in the Middle East and Africa. Strong enterprise digital transformation focus with CX tracks. Relevant for Khoros MEA market expansion and enterprise partnership development.'
})

seed({
  name: 'Asia Tech x Singapore (ATxSG) 2026',
  type: 'conference',
  start_date: '2026-06-01', end_date: '2026-06-30',
  location: 'Singapore',
  attendees: 10000,
  low: 15000, high: 60000,
  fit: 'Low',
  audience: 'Asian tech and government digital leaders — limited direct Khoros CX ICP overlap, more useful for APAC market presence.',
  rec: 'Attend',
  desc: 'ATxSG is Singapore\'s flagship technology event organized by IMDA. Government and enterprise digital transformation focus. Limited CX platform buyer density but useful for APAC market presence.'
})

seed({
  name: 'AI Summit Seoul 2026',
  type: 'conference',
  start_date: '2026-11-01', end_date: '2026-11-30',
  location: 'Seoul, South Korea',
  attendees: 3000,
  low: 10000, high: 40000,
  fit: 'Low',
  audience: 'Korean enterprise AI leaders — limited Khoros ICP overlap outside of APAC expansion strategy.',
  rec: 'Attend',
  desc: 'AI Summit Seoul covers enterprise AI adoption in South Korea. Limited relevance for current Khoros market focus but relevant for potential APAC expansion.'
})

// ══════════════════════════════════════════════════════════════════════
// MEDIA / PODCASTS (from spreadsheet)
// ══════════════════════════════════════════════════════════════════════

seed({
  name: 'ShowStoppers @ MWC Barcelona 2027',
  type: 'trade-show',
  start_date: '2027-02-28', end_date: '2027-03-06',
  location: 'Barcelona, Spain', venue: 'Fira Barcelona Gran Via',
  attendees: 2500,
  low: 10000, high: 40000,
  fit: 'Low',
  audience: 'Media and tech journalists at MWC — limited direct Khoros CX buyer overlap but useful for PR and analyst relations.',
  rec: 'Attend',
  desc: 'ShowStoppers is a press and analyst event held during MWC Barcelona. Primary value is earned media coverage rather than direct sales. Useful if Khoros has new product announcements to amplify.'
})

seed({
  name: 'ShowStoppers @ IFA Berlin 2026',
  type: 'trade-show',
  start_date: '2026-09-04', end_date: '2026-09-08',
  location: 'Berlin, Germany',
  attendees: 2000,
  low: 8000, high: 30000,
  fit: 'Low',
  audience: 'Consumer tech media and journalists — minimal Khoros enterprise CX buyer overlap.',
  rec: 'Attend',
  desc: 'ShowStoppers at IFA targets consumer tech media. Very limited relevance for Khoros enterprise B2B platform sales, but could support consumer-facing brand visibility if relevant product launches are planned.'
})

seed({
  name: 'AI in Business Podcast (Emerj) — Sponsorship 2026',
  type: 'other',
  start_date: '2026-01-01', end_date: '2026-12-31',
  location: 'Remote / Podcast',
  attendees: 50000,
  low: 5000, high: 25000,
  fit: 'Medium',
  audience: 'Enterprise AI decision-makers and technology leaders who follow AI in Business podcast — strong awareness channel for Khoros AI capabilities.',
  rec: 'Sponsor',
  desc: "Emerj's AI in Business podcast reaches enterprise AI decision-makers year-round. Podcast sponsorship or guest appearance provides always-on thought leadership channel for Khoros Aurora AI and IRIS AI positioning."
})

seed({
  name: 'Cognitive Revolution Podcast — Sponsorship 2026',
  type: 'other',
  start_date: '2026-01-01', end_date: '2026-12-31',
  location: 'Remote / Podcast',
  attendees: 30000,
  low: 3000, high: 15000,
  fit: 'Low',
  audience: 'AI practitioners and enthusiasts — more technical audience, limited enterprise CX buyer concentration.',
  rec: 'Evaluate',
  desc: 'The Cognitive Revolution covers advanced AI topics. Primarily technical audience with limited enterprise CX buyer overlap. Consider only if Khoros wants to build AI engineering credibility.'
})

// ══════════════════════════════════════════════════════════════════════
// ADDITIONAL HIGH-VALUE CX/COMMUNITY EVENTS
// ══════════════════════════════════════════════════════════════════════

seed({
  name: 'Gainsight Pulse 2026',
  type: 'conference',
  start_date: '2026-05-12', end_date: '2026-05-14',
  location: 'San Francisco, CA, USA',
  attendees: 5000,
  low: 25000, high: 80000,
  fit: 'High',
  audience: 'Customer success leaders, VP Customer Success, and community professionals — direct competitive battleground for Khoros versus Gainsight community and CS tools.',
  rec: 'Sponsor',
  desc: "Gainsight Pulse is the premier Customer Success conference. Critical competitive venue for Khoros — attendees are evaluating community and CS platforms directly competing with Khoros. High-value for competitive displacement messaging."
})

seed({
  name: 'Zendesk Relate 2026',
  type: 'conference',
  start_date: '2026-04-15', end_date: '2026-04-17',
  location: 'Las Vegas, NV, USA',
  attendees: 3000,
  low: 20000, high: 80000,
  fit: 'High',
  audience: 'Customer service and support leaders, VP Customer Care — direct match for Khoros digital contact center and customer care platform buyers.',
  rec: 'Sponsor',
  desc: "Zendesk Relate attracts enterprise customer service leaders directly evaluating Khoros-competitive products. Strategic sponsorship creates competitive displacement opportunities among customers considering Zendesk versus Khoros digital care solutions."
})

seed({
  name: 'CX Network Live 2026',
  type: 'conference',
  start_date: '2026-10-20', end_date: '2026-10-22',
  location: 'New York, NY, USA',
  attendees: 1500,
  low: 15000, high: 50000,
  fit: 'High',
  audience: 'Senior CX executives and digital transformation leaders — premium executive audience with high purchase authority for Khoros enterprise platform.',
  rec: 'Sponsor',
  desc: 'CX Network Live focuses on enterprise customer experience strategy with C-suite and VP-level attendance. High-value executive networking for Khoros enterprise sales team with quality over quantity attendee profile.'
})

const count = db.prepare('SELECT COUNT(*) as n FROM opportunities').get().n
console.log(`✓ Seeded opportunities table. Total opportunities: ${count}`)

const breakdown = db.prepare(`
  SELECT strategic_fit, COUNT(*) as n FROM opportunities GROUP BY strategic_fit ORDER BY
  CASE strategic_fit WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END
`).all()
breakdown.forEach(r => console.log(`  ${r.strategic_fit}: ${r.n}`))

db.close()
