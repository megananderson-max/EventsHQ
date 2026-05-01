// update-opportunities.mjs
// Adds relevant_for column and rewrites audience_match for all 49 opportunities
// with accurate IgniteTech / Khoros / both attribution

import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dirname, 'events.db'))

// 1. Add relevant_for column if missing
try { db.exec(`ALTER TABLE opportunities ADD COLUMN relevant_for TEXT DEFAULT 'khoros'`) } catch {}

// 2. Each entry: { id, relevant_for, audience_match }
// relevant_for: 'ignitetech' | 'khoros' | 'both'
// audience_match: crisp, event-specific, company-accurate reasoning

const updates = [
  // ─── AI & ENTERPRISE TECH — NORTH AMERICA ────────────────────────────────
  {
    id: 1, // AI4 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: AI product leaders and enterprise CX architects evaluating AI-powered customer engagement platforms — directly relevant to Aurora AI and IRIS AI. For IgniteTech: a showcase stage for the broader AI-first software portfolio, reinforcing the company\'s AI acquisition and revitalisation strategy.'
  },
  {
    id: 2, // The AI Summit New York 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: Fortune 500 CDOs and VP Digital Transformation roles actively purchasing AI-driven CX platforms — high conversion audience for Aurora AI demos. For IgniteTech: one of the highest-profile enterprise AI stages in the US, ideal for Eric Vaughan to position IgniteTech as an AI-first enterprise software acquirer.'
  },
  {
    id: 3, // VentureBeat Transform 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: senior enterprise AI practitioners and CTOs evaluating AI-augmented customer service and community tools. For IgniteTech: VentureBeat Transform is where PE-backed and AI-first software companies gain analyst and press coverage — strong platform for IgniteTech\'s acquisition-and-AI story.'
  },
  {
    id: 4, // GAI World 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: generative AI product buyers in enterprise CX and operations, interested in AI-native community and care features. For IgniteTech: relevant to the Eloquens AI, MyPersonas, and Adminio portfolio, positioning IgniteTech as a practitioner in applied enterprise GenAI.'
  },
  {
    id: 5, // HumanX 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: C-suite digital CX leaders exploring where AI augments human customer interactions — exact audience for Khoros\'s AI-human hybrid support and community engagement positioning. For IgniteTech: thematically aligned to the "AI + human expertise" message across the IgniteTech software portfolio.'
  },
  {
    id: 8, // Databricks Data + AI Summit 2026
    relevant_for: 'ignitetech',
    audience_match: 'Primarily for IgniteTech: data and AI engineering leaders, CDOs, and analytics platform buyers. IgniteTech\'s AI-first portfolio story — including Eloquens AI, MyPersonas, and Adminio — resonates here more than Khoros\'s CX products, which target business buyers rather than data practitioners.'
  },
  {
    id: 9, // GenAI Summit SF 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: enterprise AI product builders evaluating LLM-powered CX and community features — relevant for Aurora AI and IRIS AI positioning on the West Coast. For IgniteTech: the SF Bay Area AI ecosystem is a target audience for IgniteTech\'s AI software acquisition strategy and thought leadership.'
  },
  {
    id: 10, // Augmented Enterprise Summit 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: enterprise operations and CX leaders exploring AI augmentation of customer service workflows and community moderation. For IgniteTech: directly aligned to the company\'s core thesis of using AI to revitalise and augment mature enterprise software products.'
  },
  {
    id: 11, // Momentum AI New York 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: east coast enterprise AI and digital transformation leaders in financial services and media — sectors with high community and contact center platform spend. For IgniteTech: a New York-based platform to engage PE, finance, and enterprise software buyers about IgniteTech\'s AI-powered portfolio.'
  },
  {
    id: 12, // ODSC AI Executive Summit (AIX East) 2026
    relevant_for: 'ignitetech',
    audience_match: 'Primarily for IgniteTech: data science executives and C-suite AI investment decision-makers. The academic and technical depth of this event aligns better to IgniteTech\'s AI-first research and product strategy than to Khoros\'s commercial CX platform sales cycle.'
  },
  {
    id: 13, // Gartner Data & Analytics Summit 2027
    relevant_for: 'both',
    audience_match: 'For Khoros: enterprise data and analytics leaders who influence platform procurement — Gartner Magic Quadrant placement directly affects Khoros deals. For IgniteTech: Gartner\'s analyst community shapes enterprise software buying decisions across the full portfolio, making this a high-leverage investment.'
  },
  {
    id: 14, // Info-Tech LIVE 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: IT directors and enterprise software evaluators who sit in the buying cycle for community, care, and social platforms. For IgniteTech: Info-Tech Research Group covers the enterprise SaaS landscape broadly, giving IgniteTech exposure to CIOs and IT leaders evaluating its full software portfolio.'
  },
  {
    id: 18, // Leaders In AI Summit 2026
    relevant_for: 'ignitetech',
    audience_match: 'Primarily for IgniteTech: intimate, invitation-style summit for senior AI executives. The small, high-quality format is ideal for Eric Vaughan to build relationships with peer enterprise software CEOs and AI leaders, and to position IgniteTech\'s AI-first acquisition strategy. Not a Khoros product event.'
  },
  {
    id: 19, // ACM AI Leadership Summit 2026
    relevant_for: 'ignitetech',
    audience_match: 'Primarily for IgniteTech: academic and research AI leaders at universities and national labs. Limited direct CX buyer overlap for Khoros, but valuable for IgniteTech establishing AI thought leadership credibility and connecting with research partners relevant to Eloquens AI and MyPersonas development.'
  },

  // ─── CX / CONTACT CENTER ─────────────────────────────────────────────────
  {
    id: 6, // Salesforce Dreamforce 2026
    relevant_for: 'khoros',
    audience_match: 'For Khoros: the highest concentration of enterprise CRM, CX, and customer success buyers anywhere — VP Customer Experience, Director of Customer Community, and Contact Center VP roles who evaluate Khoros against Salesforce\'s own CX products. Critical competitive battleground for Khoros Community and Care against Service Cloud and Experience Cloud.'
  },
  {
    id: 7, // Google Cloud Next 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: enterprise cloud and digital transformation architects who specify the CX platform stack, including buyers who deploy Khoros on Google Cloud infrastructure. For IgniteTech: strategic partnership and co-sell opportunity with Google Cloud across the full enterprise software portfolio.'
  },
  {
    id: 17, // Enterprise Connect 2027
    relevant_for: 'khoros',
    audience_match: 'For Khoros: the definitive US event for contact center, CCaaS, and unified communications buyers — VP Customer Service, Contact Center Director, and Head of Digital Care roles evaluating Khoros Digital Contact Center against Genesys, Five9, and NICE. Highest ROI event for the Khoros contact center product line.'
  },
  {
    id: 20, // Customer Contact Week (CCW) 2026
    relevant_for: 'khoros',
    audience_match: 'For Khoros: world\'s largest contact center event, drawing 3,000+ contact center VPs, digital care directors, and CX operations leaders. These are the exact buyers evaluating Khoros Care and Digital Contact Center against Zendesk, Sprinklr, and Genesys. The single most important contact center event for Khoros annually.'
  },
  {
    id: 21, // Gartner Customer Experience & Technologies Summit 2026
    relevant_for: 'khoros',
    audience_match: 'For Khoros: Gartner\'s CX summit is where Chief Customer Officers and VP CX roles make or validate platform purchasing decisions, directly referencing Gartner Magic Quadrant ratings. Sponsoring here gives Khoros maximum visibility at the moment enterprise buyers are shortlisting vendors — essential for displacing Sprinklr and Salesforce.'
  },
  {
    id: 22, // Forrester CX Summit North America 2026
    relevant_for: 'khoros',
    audience_match: 'For Khoros: Forrester Wave placements are cited in nearly every enterprise CX deal — this summit puts Khoros in front of the VPs and Directors who use Forrester research to justify platform selections. The analyst community attending directly influences Khoros\'s competitive position against Sprinklr, Salesforce Service Cloud, and Zendesk.'
  },
  {
    id: 23, // ICMI Contact Center Expo 2026
    relevant_for: 'khoros',
    audience_match: 'For Khoros: ICMI is the definitive contact center practitioner event — Contact Center Managers, Directors of Customer Service Operations, and VP Customer Care roles actively evaluating digital-first contact center platforms. Direct ICP for Khoros Digital Contact Center and Care, competing against Genesys, Five9, Verint, and Zendesk.'
  },
  {
    id: 47, // Gainsight Pulse 2026
    relevant_for: 'khoros',
    audience_match: 'For Khoros: Gainsight Pulse attracts VP Customer Success, Chief Customer Officer, and Community Manager roles — the same buyers who implement Khoros Community to reduce support tickets and drive product adoption. Strong overlap with the community-led growth trend Khoros is championing against Higher Logic and Bettermode.'
  },
  {
    id: 48, // Zendesk Relate 2026
    relevant_for: 'khoros',
    audience_match: 'For Khoros: Zendesk Relate draws CX and customer service leaders who are Zendesk customers — a prime pool of competitive displacement targets for Khoros Care and Digital Contact Center. Sponsoring or attending alongside Zendesk\'s own event creates direct comparison opportunities with enterprise buyers actively re-evaluating their CX stack.'
  },
  {
    id: 49, // CX Network Live 2026
    relevant_for: 'khoros',
    audience_match: 'For Khoros: CX Network Live targets CX programme directors, head of customer operations, and VP CX roles at large enterprises — exact Khoros ICP for community, care, and omnichannel engagement. Smaller, practitioner-focused format means high-quality, decision-ready prospects for Khoros\'s account-based sales motion.'
  },
  {
    id: 38, // Customer Experience Live Europe 2026
    relevant_for: 'khoros',
    audience_match: 'For Khoros: Europe\'s dedicated CX conference drawing VP CX, Head of Customer Operations, and Digital Care directors from UK and EU enterprises. As Khoros expands its European footprint, this event provides direct access to senior CX buyers in financial services, retail, and telecom — industries with significant Khoros contract potential.'
  },

  // ─── COMMUNITY ───────────────────────────────────────────────────────────
  {
    id: 24, // CMX Summit 2026
    relevant_for: 'khoros',
    audience_match: 'For Khoros: CMX Summit is the single most important community management event in the world — drawing Community Managers, VP Community, and Head of Online Community roles who are the direct users and buyers of Khoros Community (Aurora). Essential for brand reinforcement, competitive positioning against Higher Logic and Bettermode, and sourcing community manager advocates.'
  },
  {
    id: 25, // Higher Logic Super Forum 2026
    relevant_for: 'khoros',
    audience_match: 'For Khoros: Higher Logic Super Forum is a direct competitive battleground — association and brand community professionals who are current Higher Logic customers and therefore active displacement targets for Khoros Community. Attending or sponsoring allows Khoros to present an alternative to prospects who are already in the market.'
  },

  // ─── SOCIAL MEDIA / MARTECH ──────────────────────────────────────────────
  {
    id: 26, // Social Media Marketing World 2027
    relevant_for: 'khoros',
    audience_match: 'For Khoros: Social Media Marketing World is the largest annual gathering of Head of Social, Social Media Manager, and VP Digital Marketing roles at enterprise brands — the exact buyers of Khoros Social Media Management. Critical for competing against Sprinklr, Hootsuite, and Sprout Social where buyers actively compare platforms.'
  },
  {
    id: 27, // MarTech Conference 2026
    relevant_for: 'khoros',
    audience_match: 'For Khoros: MarTech draws VP Marketing Technology and MarTech stack owners who manage the enterprise social, community, and digital engagement tech stack — precisely the decision-makers who purchase Khoros Social and evaluate it against Sprinklr, Brandwatch, and Hootsuite. High potential for pipeline from a relatively cost-efficient sponsorship.'
  },

  // ─── BROAD / AWARENESS ───────────────────────────────────────────────────
  {
    id: 15, // SXSW 2027
    relevant_for: 'both',
    audience_match: 'For Khoros: SXSW Interactive draws community builders, digital experience leaders, and social media strategists who are early adopters and influencers for Khoros\'s platform categories. For IgniteTech: the broader innovation and tech culture narrative at SXSW is a strong platform for Eric Vaughan to speak on AI-augmented enterprise software and IgniteTech\'s acquisition philosophy.'
  },
  {
    id: 16, // CES 2027
    relevant_for: 'ignitetech',
    audience_match: 'Primarily for IgniteTech: CES draws CEOs, CIOs, and enterprise technology innovation leaders from global corporations — the executive tier that interacts with IgniteTech as a portfolio company and potential acquirer. Limited relevance for Khoros product sales, but valuable for IgniteTech brand presence alongside major enterprise tech players and potential acquisition targets.'
  },

  // ─── EUROPE ──────────────────────────────────────────────────────────────
  {
    id: 28, // RAISE Summit 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: French and EU enterprise technology leaders evaluating AI-driven CX platforms as part of European digital transformation programmes. For IgniteTech: RAISE is co-organised by the French government and draws European heads of state and tech ministers — a rare opportunity for IgniteTech to engage European policy-makers and enterprise buyers at the same time.'
  },
  {
    id: 29, // AI Summit London 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: UK and European enterprise CX and AI leaders — London is Khoros\'s largest European market, making this the top AI conference for reaching UK financial services, retail, and telecom CX buyers. For IgniteTech: London is also IgniteTech\'s European base and this conference provides direct exposure to UK enterprise software decision-makers for the full portfolio.'
  },
  {
    id: 30, // World Summit AI 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: Amsterdam-based enterprise AI leaders evaluating AI-powered CX and community platforms across continental Europe — DACH, Benelux, and Nordic markets. For IgniteTech: World Summit AI has a strong PE and VC presence in Amsterdam, relevant to IgniteTech\'s European investment and acquisition activity.'
  },
  {
    id: 31, // GITEX Europe Berlin 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: GITEX\'s European expansion draws German and DACH enterprise technology buyers — a market where Khoros has growth potential in financial services and manufacturing CX. For IgniteTech: GITEX Europe brings together enterprise software companies, system integrators, and government buyers, aligned to IgniteTech\'s portfolio sales strategy.'
  },
  {
    id: 32, // VivaTech 2026
    relevant_for: 'ignitetech',
    audience_match: 'Primarily for IgniteTech: VivaTech is France\'s largest startup and tech innovation event, drawing European VCs, corporate venture arms, and innovation leaders. Better suited to IgniteTech\'s corporate development and acquisition pipeline than to Khoros\'s product sales cycle. Limited concentration of Khoros CX ICP buyers among the startup-heavy audience.'
  },
  {
    id: 33, // Web Summit 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: Web Summit\'s enterprise technology tracks include community, digital experience, and CX leaders from European and global enterprises — a useful mid-funnel awareness channel for Khoros in markets like Ireland, UK, and Southern Europe. For IgniteTech: one of the world\'s most watched tech conferences for announcing company direction and reaching European enterprise software buyers and investors.'
  },
  {
    id: 34, // London Tech Week 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: London Tech Week draws UK enterprise CX, digital, and community leaders across the financial services, media, and retail sectors where Khoros has its strongest UK accounts. For IgniteTech: the Government and Enterprise AI tracks at London Tech Week are ideal for IgniteTech leadership, particularly following the FT Future of AI event in November.'
  },
  {
    id: 35, // AI & Big Data Expo Europe 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: enterprise AI and data leaders evaluating AI-powered CX and community platforms, particularly from UK and European financial services and retail. For IgniteTech: the Big Data and AI expo format directly aligns to IgniteTech\'s AI-first positioning, with exhibitor and speaking opportunities to showcase the full AI product portfolio alongside Khoros.'
  },
  {
    id: 36, // Slush 2026
    relevant_for: 'ignitetech',
    audience_match: 'Primarily for IgniteTech: Slush is Europe\'s leading startup and VC conference in Helsinki, drawing leading European and global investors, founders, and corporate venturers. This is a strategic event for IgniteTech\'s corporate development team to explore European acquisition targets and build investor relationships — not a Khoros product event.'
  },
  {
    id: 37, // Hannover Messe 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: industrial enterprise and manufacturing companies attending Hannover Messe are increasingly deploying digital customer communities and partner portals — a growing segment for Khoros Community. For IgniteTech: as a portfolio company operator, IgniteTech\'s supply chain and industrial software assets (including Suuchi) have direct audience overlap with Hannover Messe\'s industrial enterprise buyers.'
  },

  // ─── APAC ────────────────────────────────────────────────────────────────
  {
    id: 39, // SuperAI Singapore 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: Singapore-based enterprise AI and CX leaders across Southeast Asia\'s financial services and telco sectors — markets where Khoros has growth potential and competes with regional CX platforms. For IgniteTech: SuperAI is Singapore\'s flagship AI event, drawing APAC investors and enterprise software buyers relevant to IgniteTech\'s Asia-Pacific expansion strategy.'
  },
  {
    id: 40, // GITEX Global 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: GITEX Global in Dubai draws enterprise technology buyers from the Middle East, Africa, and South Asia — a high-growth region for customer community and contact centre platforms in government, banking, and telco. For IgniteTech: GITEX is the definitive Middle East enterprise software event and a platform for IgniteTech to showcase its full portfolio to Gulf Cooperation Council enterprise and government buyers.'
  },
  {
    id: 41, // Asia Tech x Singapore (ATxSG) 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: Singapore government and APAC enterprise technology leaders evaluating digital engagement and CX platforms for public services and enterprise deployment. For IgniteTech: ATxSG has a strong enterprise software and government procurement track, relevant to IgniteTech\'s APAC market entry and partnership strategy.'
  },
  {
    id: 42, // AI Summit Seoul 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: South Korean enterprise AI and CX leaders at Samsung, Hyundai, LG, and major Korean banks — companies that deploy large-scale customer community and contact centre platforms. For IgniteTech: South Korea is a significant enterprise software market; Eric Vaughan speaking at AI Summit Seoul positions IgniteTech\'s AI-first strategy with Korean chaebols and tech conglomerates.'
  },

  // ─── MEDIA / CONSUMER TECH ───────────────────────────────────────────────
  {
    id: 43, // ShowStoppers @ MWC Barcelona 2027
    relevant_for: 'khoros',
    audience_match: 'For Khoros: MWC Barcelona draws global telco operators, smartphone OEMs, and digital media companies — sectors with very large customer communities and contact centres that are prime targets for Khoros Community and Digital Contact Center. The adjacent ShowStoppers event gives Khoros access to senior telco CX decision-makers in a more intimate setting.'
  },
  {
    id: 44, // ShowStoppers @ IFA Berlin 2026
    relevant_for: 'khoros',
    audience_match: 'For Khoros: IFA Berlin is Europe\'s largest consumer electronics show with significant presence from European retailers and consumer brands that operate large customer communities and contact centres. ShowStoppers provides a more targeted B2B access point to retail CX and brand community decision-makers in the DACH and Benelux markets.'
  },

  // ─── PODCASTS ────────────────────────────────────────────────────────────
  {
    id: 45, // AI in Business Podcast (Emerj) — Sponsorship 2026
    relevant_for: 'both',
    audience_match: 'For Khoros: Emerj\'s AI in Business podcast reaches enterprise AI buyers and CX technology leaders evaluating AI-native platforms — a strong content channel for Khoros Aurora AI and IRIS AI positioning. For IgniteTech: Emerj\'s audience of enterprise AI decision-makers and analysts is directly relevant to IgniteTech\'s AI-first software portfolio narrative and acquisition strategy.'
  },
  {
    id: 46, // Cognitive Revolution Podcast — Sponsorship 2026
    relevant_for: 'ignitetech',
    audience_match: 'Primarily for IgniteTech: The Cognitive Revolution covers AI research, frontier models, and enterprise AI strategy — an audience of AI engineers, researchers, and technical founders. Better aligned to IgniteTech\'s AI product development story (Eloquens AI, MyPersonas, Adminio) than to Khoros\'s commercial CX sales. Eric Vaughan appearing on this podcast would position IgniteTech in the AI builder community.'
  },
]

console.log(`Updating ${updates.length} opportunities...`)

const stmt = db.prepare('UPDATE opportunities SET relevant_for = ?, audience_match = ? WHERE id = ?')
let updated = 0

for (const u of updates) {
  const result = stmt.run(u.relevant_for, u.audience_match, u.id)
  if (result.changes > 0) {
    updated++
    console.log(`  ✓ ${u.id}: [${u.relevant_for}]`)
  } else {
    console.log(`  ⚠ ${u.id}: NOT FOUND`)
  }
}

// Any remaining opps not in our list — set a sensible default
const untouched = db.prepare(`
  SELECT id, name, focus_area FROM opportunities
  WHERE relevant_for IS NULL OR relevant_for = 'khoros'
  AND id NOT IN (${updates.map(u => u.id).join(',')})
`).all()

if (untouched.length > 0) {
  console.log(`\nUntouched (keeping default 'khoros'):`)
  untouched.forEach(o => console.log(`  ${o.id}: ${o.name}`))
}

// Summary
const summary = db.prepare(`
  SELECT relevant_for, COUNT(*) as count FROM opportunities GROUP BY relevant_for
`).all()

console.log(`\n════════════════════════════════`)
console.log(`DONE: ${updated} opportunities updated`)
console.log(`Breakdown:`)
summary.forEach(s => console.log(`  ${s.relevant_for}: ${s.count}`))
