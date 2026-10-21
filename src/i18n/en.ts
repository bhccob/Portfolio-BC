import type { CountryId } from '../data/directions';
import type { PartId } from '../data/parts';

/** One compass part in the dissect: its name and a line of at most ten words. */
export interface PartCopy {
  name: string;
  line: string;
}

/** One country: its card on the compass, its page's three beats and its meta description. */
export interface CountryCopy {
  name: string;
  /** The line on the country's focus card. */
  teaser: string;
  beats: [string, string, string];
  metaDescription: string;
}

// The eleven parts and three countries, copied verbatim from the NL and EN columns
// of docs/art-direction.md § Copy budget (Bob approved them on 2026-10-20).
// tests/unit/needle-copy.test.ts compares them with that table.
const parts: Record<PartId, PartCopy> = {
  lid: { name: 'Lid', line: 'Protects the dial while the compass travels.' },
  rim: { name: 'Dragon-relief rim', line: 'Holds the glass and gives the hand a grip.' },
  crystal: { name: 'Crystal', line: 'Keeps wind and dust away from the needle.' },
  strings: { name: 'Red sighting strings', line: 'Two crossed threads read the bearing off the rings.' },
  bagua: { name: 'Bagua ring', line: 'Eight trigrams divide the horizon into eight directions.' },
  degrees: { name: 'Degree ring', line: '360 ticks turn a direction into a number.' },
  dial: { name: 'Heaven plate', line: 'The turning dial you line up with a bearing.' },
  jewel: { name: 'Pivot jewel', line: 'A hard jewel lets the needle turn almost without friction.' },
  needle: { name: 'Needle', line: "Magnetised steel that lines up with Earth's magnetic field." },
  plate: { name: 'Earth plate', line: 'The fixed square base that keeps the compass level.' },
  housing: { name: 'Housing', line: 'Carries every ring; next, it becomes the hard drive.' }
};

const countries: Record<CountryId, CountryCopy> = {
  china: {
    name: 'China',
    teaser: 'I am of Chinese heritage; this compass comes from that tradition.',
    beats: [
      'My family is of Chinese heritage.',
      'That heritage is a source of identity and belonging for me.',
      'Hakka, a Chinese dialect, is my mother tongue.'
    ],
    metaDescription: 'I am of Chinese heritage; this compass comes from that tradition.'
  },
  netherlands: {
    name: 'The Netherlands',
    teaser: 'At eighteen I moved to the Netherlands. I now study in Rotterdam.',
    beats: [
      'At eighteen I moved from Aruba to the Netherlands.',
      'Here I took up running and am learning to be financially independent.',
      'In Rotterdam I study software engineering (MBO 4) and explore further studies.'
    ],
    metaDescription: 'At eighteen I moved to the Netherlands. I now study in Rotterdam.'
  },
  aruba: {
    name: 'Aruba',
    teaser: 'I was born and raised here, between trade winds and sea.',
    beats: [
      'I was born and raised in Aruba.',
      'Aruba taught me to speak several languages and to connect with people.',
      'The gym gave me purpose, a more active life and friends.'
    ],
    metaDescription: 'I was born and raised here, between trade winds and sea.'
  }
};

/**
 * English copy. This object defines the shape of every dictionary:
 * `nl.ts` is typed against it, so a missing Dutch key fails type-checking.
 * Strings that contain markup are rendered with `set:html` and only ever
 * come from this file, never from user input.
 */
export const en = {
  /**
   * The head of each page. A title here is the page's own words: `head()`
   * (src/seo/head.ts) adds " | Bob Chung" after it. `homeTitle` is the one
   * complete title, used as it is.
   */
  meta: {
    homeTitle: 'Bob Chung | Student Software Engineer in Rotterdam',
    homeDescription:
      'Portfolio of Bob Chung, a student software engineer in Rotterdam: game and web projects, and a route toward systems and firmware security engineering.',
    liteDescription: 'The Lite version of the portfolio of Bob Chung: all of the content as plain text, without 3D.',
    contactTitle: 'Contact',
    contactDescription: 'Send Bob Chung a message straight from his portfolio, or find him on GitHub and Instagram.',
    notFoundTitle: 'Page not found',
    notFoundDescription: 'This page does not exist. Head back to the portfolio of Bob Chung.'
  },
  nav: {
    work: 'Work',
    about: 'About',
    career: 'Career',
    contact: 'Contact',
    send: 'Send a message',
    menu: 'Menu',
    close: 'Close menu',
    terminal: 'Open terminal',
    skip: 'Skip to content',
    language: 'Language',
    switchTo: 'Bekijk deze pagina in het Nederlands',
    home: 'Bob Chung, back to home'
  },
  loader: {
    label: 'Loading portfolio',
    status: 'Preparing departures',
    skip: 'Click or press any key to skip'
  },
  hero: {
    hello: 'Hey, I’m',
    name: ['Bob', 'Chung'],
    motto: [
      ['I build with', 'fat'],
      ['curiosity', 'light'],
      ['& test with', 'fat'],
      ['honesty.', 'light']
    ],
    role: 'Student software engineer · Rotterdam, NL',
    hint: 'Move over my name',
    hintTouch: 'Tap my name',
    badge: 'Student software engineer • Born in Aruba • Based in Rotterdam • ',
    scroll: 'Scroll down'
  },
  work: {
    title: 'Projects, <em>one build at a time.</em>',
    intro:
      'My projects are grouped by discipline. Pick a category to browse its projects: what each one is, how it was built and what I focused on.',
    countOne: '1 project',
    countMany: '{n} projects',
    project: 'Project',
    category: 'Category',
    type: 'Type',
    year: 'Year',
    role: 'Role',
    stack: 'Built with',
    status: 'Status',
    github: 'View on GitHub',
    caseStudy: 'Read the case study',
    view: 'View projects',
    rail: 'Projects',
    nextTitle: 'Next category: <em>systems & security.</em>',
    nextText:
      'The directions I am exploring lead toward systems and security. Once projects in that area are finished, they will get a category of their own here.',
    nextLink: 'See the roadmap',
    heldTitle: 'Not everything is listed',
    heldText:
      'Earlier projects exist, but only work that meets the standard I set for this portfolio makes it onto this page.'
  },
  about: {
    title: 'The route <em>so far.</em>',
    mixed: [
      ['I’m Bob,', 'fat'],
      ['a', 'light'],
      ['{age}-year-old', 'fat-yellow'],
      ['student', 'caps'],
      ['software engineer.', 'fat'],
      ['Born and raised in', 'light'],
      ['Aruba,', 'fat'],
      ['Chinese', 'fat-yellow'],
      ['by heritage,', 'light'],
      ['and based in', 'caps'],
      ['Rotterdam', 'fat'],
      ['since eighteen.', 'light']
    ],
    lead:
      'I’m Bob Chung, a <span data-age>{age}</span>-year-old student software engineer based in Rotterdam. Born and raised in Aruba and Chinese by heritage, I moved to the Netherlands at eighteen.',
    body:
      'I work across databases, game development and web development, and each discipline sharpens the others. Hardware and electrical engineering are next on my route. I build with curiosity and test with honesty.',
    /** The line v3's China page told, moved here with the countries gone (Bob approved this wording). */
    hakka: 'Hakka, a Chinese dialect, is my mother tongue.',
    quote: 'Home isn’t one place for me. It’s a blend of cultures and the questions I keep chasing.',
    thoughtLabel: 'A rule I keep',
    thought: '“Overthinking is fear pretending to be logic.”',
    portraitAlt: 'Portrait of Bob Chung',
    facts: {
      age: 'Age',
      born: 'Born',
      bornValue: 'Aruba',
      heritage: 'Heritage',
      heritageValue: 'Chinese',
      based: 'Based in',
      basedValue: 'Rotterdam, NL',
      studying: 'Studying',
      studyingValue: 'MBO 4, Rotterdam'
    },
    route: {
      label: 'Origin route',
      heritage: 'Heritage',
      heritagePlace: 'China',
      born: 'Born & raised',
      bornPlace: 'Aruba',
      now: 'Since eighteen',
      nowPlace: 'Rotterdam'
    },
    clock: {
      label: 'Local time',
      apart: '{h} hours apart'
    }
  },
  skills: {
    title: 'What I work <em>with.</em>',
    statement: [
      ['A solid', 'light'],
      ['full-stack', 'fat-yellow'],
      ['foundation,', 'fat'],
      ['sharpened toward', 'light'],
      ['systems', 'fat'],
      ['and', 'light'],
      ['firmware,', 'fat'],
      ['accelerated by', 'caps'],
      ['AI', 'fat-yellow'],
      ['and curious about', 'light'],
      ['hardware.', 'fat']
    ],
    statementSpoken: 'A solid full-stack foundation, sharpened toward systems and firmware, accelerated by AI and curious about hardware.',
    rows: [
      {
        status: 'Solid',
        title: 'Full-stack foundation',
        text: 'A working command of the core programming languages, relational databases with SQL, game development in Godot and modern frameworks: enough to build a project from the database all the way to the interface.'
      },
      {
        status: 'In progress',
        title: 'Specialising',
        text: 'Deepening the specific skills that my possible future roles require, in engineering and cybersecurity: programming closer to the hardware for embedded systems, building reliable data pipelines, integrating security into every stage of development (DevSecOps), and automating how firmware is tested and secured.'
      },
      {
        status: 'Daily',
        title: 'Working with AI',
        text: 'Learning to use AI to my advantage: to research faster, prototype ideas, and review and test my work, while remaining responsible for every line I deliver.'
      },
      {
        status: 'Next',
        title: 'Curious about',
        text: 'Electronics and the hardware that software runs on, and financial technology (fintech): how payment systems, banking platforms and financial data are engineered, secured and kept reliable under strict regulation.'
      }
    ]
  },
  life: {
    title: 'Off <em>duty.</em>',
    text: 'Outside of code I keep moving. I’m a former powerlifter and table tennis player; today I run, train at the gym and play games to stay fit, focused and balanced.',
    current: 'Now',
    former: 'Formerly',
    hobbies: {
      running: 'Running',
      runningText: 'Endurance and a clear head.',
      gym: 'Gym',
      gymText: 'Strength, built progressively.',
      gaming: 'Gaming',
      gamingText: 'Play, and an eye for good game design.',
      powerlifting: 'Powerlifting',
      tableTennis: 'Table tennis'
    }
  },
  career: {
    title: 'Current build <em>& roadmap.</em>',
    currentStatus: 'In service',
    currentRole: 'Student Software Engineer',
    currentOrg: 'MBO 4 · Rotterdam',
    currentText:
      'Building a broad software foundation: game development in Godot, web development, relational databases and SQL, frameworks such as Laravel, and programming fundamentals across several languages.',
    hboStatus: 'Next',
    hboRole: 'HBO · Technology',
    hboOrg: 'After my MBO 4 · programme still open',
    hboText:
      'After my MBO 4, I intend to continue at HBO level in a technical field. I have not chosen the exact programme yet; directions such as HBO-ICT, Computer Science or Embedded Systems Engineering fit the roles I am working toward.',
    nextStatus: 'Possible',
    roadmapNote: 'The roles in the roadmap are possible steps in my career: directions I am interested in and working toward, not fixed plans. Where they lead is a company of my own.',
    rolesToggle: 'Possible future roles',
    rolesHint: 'Interests, not fixed plans',
    roleGroups: [
      {
        field: 'Engineering',
        roles: [
          {
            title: 'Embedded Engineer',
            text: 'Developing the software that runs directly on hardware, from microcontrollers to connected devices, within strict limits on memory, power and timing.'
          },
          {
            title: 'Data Engineer',
            text: 'Designing the pipelines and databases that turn raw data into a reliable foundation for analysis and decisions.'
          }
        ]
      },
      {
        field: 'Cybersecurity',
        roles: [
          {
            title: 'DevSecOps Engineer',
            text: 'Integrating security into every stage of software development and delivery, with automated testing from the first line of code to release.'
          }
        ]
      },
      {
        field: 'Engineering & cybersecurity',
        roles: [
          {
            title: 'Firmware Security Automation Engineer',
            text: 'Securing the low-level code inside devices and automating how it is tested and verified: embedded engineering and cybersecurity in one role.'
          }
        ]
      }
    ],
    sector: {
      label: 'Possible sector',
      title: 'Fintech',
      text: 'These skills are also in demand in financial technology, from secure payment terminals to fraud detection: one sector this path could lead through, not the destination itself.'
    },
    goalStatus: 'Goal',
    goalRole: 'A company of my own',
    goalOrg: 'Long term · the destination',
    goalText:
      'In the long term, I intend to found a technology company of my own. The roles above are the route there: each one builds the experience in hardware, software, data and security that such a company relies on.',
    whyToggle: 'Why these directions?',
    why: [
      'These directions share one thread: they are essential to the technology that society increasingly depends on. As connected devices, data and digital services continue to grow, so does the demand for engineers who can build, secure and automate them.',
      'Several of them reach beyond the screen. Embedded and firmware work joins software with electrical and mechanical engineering: reading sensors, driving motors and actuators, and designing within the limits of circuits, power and moving parts. Understanding the whole device, not only its code, is what draws me to these fields.',
      'They also suit my personality: I work best when I can focus deeply and without interruption on complex technical problems. These roles are engineering-driven rather than client-facing, and they reward exactly that way of working.',
      'Above all, they lead toward my long-term goal: founding a technology company of my own. Each role is a building block for it: the electronics and mechanics of a product, the software that runs on it, the data it produces and the security that protects it.'
    ]
  },
  hood: {
    title: 'This site is <em>a project too.</em>',
    intro: 'Two languages, each doing the job it does best: the same mindset I want to bring to systems and firmware work.',
    cards: [
      {
        lang: 'TypeScript · Astro',
        title: 'The site',
        text: 'Static, SEO-friendly pages generated by Astro, with every interactive feature written as a TypeScript class, including this board.'
      },
      {
        lang: 'Python',
        title: 'The deploy guard',
        text: 'Before every deploy, a Python auditor checks each page’s titles, descriptions, links and alt text, and stops the release if anything is off.'
      }
    ]
  },
  cta: {
    title: 'Final call: <em>say hello.</em>',
    text: 'Questions, opportunities or simply a hello: my inbox is open.',
    button: 'Send me a message',
    or: 'Or find me on'
  },
  contact: {
    title: 'Send a <em>message.</em>',
    intro: 'Have a question, an opportunity, or just want to say hello? Write it below and it will reach my inbox.',
    direct: 'Or reach me directly',
    formTitle: 'Your message',
    name: 'Name',
    namePlaceholder: 'Your name',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    subject: 'Subject',
    subjectPlaceholder: 'What is it about?',
    optional: 'optional',
    message: 'Message',
    messagePlaceholder: 'Write your message…',
    send: 'Send message',
    sending: 'Sending…',
    privacy: 'Your details are only used to reply to your message.',
    errors: {
      name: 'Please enter your name.',
      email: 'Please enter a valid email address.',
      message: 'Your message needs at least 10 characters.',
      generic: 'Something went wrong while sending. Please try again, or email me directly at bhccob@gmail.com.',
      cooldown: 'Your message has just been sent. Please wait a minute before sending another one.'
    },
    successTitle: 'Message sent.',
    successText: 'Thank you for reaching out. I’ll reply as soon as I can.',
    again: 'Send another message',
    mailtoTitle: 'Almost there.',
    mailtoText: 'Your email app should open with the message ready to send.'
  },
  project: {
    back: 'All categories',
    shelf: 'Projects in {category}',
    previous: 'Previous',
    next: 'Next',
    keys: 'Use ← and → to switch projects',
    overview: 'Overview',
    build: 'How it’s built',
    focus: 'Focus',
    alsoSee: 'Also see',
    moreTitle: 'More projects <em>are on the way.</em>',
    moreText: 'New work is in progress or waiting to be published, and earlier projects that do not meet my standard are not listed.',
    moreLink: 'Back to all categories'
  },
  footer: {
    made: 'Built with curiosity in Rotterdam',
    analytics: 'Anonymous visitor statistics, without cookies.',
    top: 'Back to top',
    terminalHint: 'Press <kbd>/</kbd> to open the terminal'
  },
  notFound: {
    status: 'Cancelled',
    title: 'This page has been <em>cancelled.</em>',
    text: 'The page you are looking for does not exist (anymore). The site was rebuilt, so some older links have moved.',
    home: 'Back to departures'
  },
  terminal: {
    title: 'bob@rotterdam: ~',
    placeholder: 'Type a command, e.g. help',
    welcome: 'Welcome to bob-shell. Type “help” to see what I can do.',
    notFound: 'command not found: {cmd}. Try “help”.',
    help: {
      help: 'list available commands',
      whoami: 'who is Bob?',
      projects: 'list projects by category',
      career: 'current build & roadmap',
      socials: 'where to find me',
      contact: 'open the contact page',
      time: 'local time in Rotterdam and Aruba',
      lang: 'switch language (en / nl)',
      clear: 'clear the screen',
      exit: 'close the terminal'
    },
    whoami:
      'Bob Chung, {age}. Student software engineer in Rotterdam. Born in Aruba, Chinese by heritage. Builds with curiosity, tests with honesty.',
    careerNow: 'now   → Student Software Engineer (MBO 4, Rotterdam)',
    careerHbo: 'next  → HBO in technology, after my MBO 4 (programme still open)',
    careerNext: 'later → possible: Embedded · Data · DevSecOps · Firmware Security Automation',
    careerGoal: 'goal  → a technology company of my own',
    opening: 'Opening {page}…',
    sudo: 'Permission granted. Redirecting you to the contact page…',
    moreSoon: '#03 next category: systems & security, on the way…'
  },
  /**
   * The words of the needle redesign, copied verbatim from the NL and EN columns of
   * docs/art-direction.md § Copy budget (Bob approved them on 2026-10-20):
   * the loader and its failure, the hero, the always-on controls, the eleven compass
   * parts, the morph line, the three countries (card line and the beats of their pages)
   * and the words around a project. `projects` and `categories` (src/data) hold the
   * project lines and labels.
   */
  needle: {
    hero: { name: 'BOB CHUNG', tagline: 'FOLLOW THE NEEDLE', scrollCue: 'Scroll' },
    loader: {
      caption: 'The needle is finding north',
      enterSilent: 'Enter without sound',
      enterSound: 'Enter with sound'
    },
    fallback: { title: 'THE NEEDLE LOST NORTH', lite: 'Open the Lite version' },
    /** The 3D switch: `label` is its accessible name, the same in both states (the switch's checked state says which); `on` and `off` are what it shows. */
    toggle: { label: '3D', on: '3D on', off: '3D off' },
    /** The link to the Lite page that every page shows. */
    liteLink: 'Lite version',
    parts,
    morph: 'The same force that guided ships now stores our data.',
    countries,
    project: { open: 'Open', download: 'Download', code: 'Code', back: 'Esc · back' }
  },
  /**
   * The redesign's compass page (/lab/compass/): its head, the hero's role line
   * and hints, the About heading (its lead is `about.lead`), the three homes'
   * labels, the stacked page's six stills' alt texts and the loader's readout
   * ({n}: the percentage). The drive's sections add the work heading and its
   * caption (the stack and AI rows are `skills.rows`), the change line, the
   * hidden projects heading, the test-point label ({n}: the number, {label}:
   * the test point; the projects' own words are `src/data/projects.ts`), Off duty
   * (its lists are `life.current` and `life.former`), the Q&A's questions (its
   * answers are `career`) and the greeting.
   */
  compass: {
    meta: {
      title: 'Compass study | Bob Chung',
      description: 'A preview of the redesigned portfolio: a compass whose needle follows your cursor.'
    },
    role: 'Student software engineer · Rotterdam',
    hints: { scroll: 'Scroll', drag: 'Drag to turn' },
    about: { title: 'About me' },
    homes: {
      china: 'Chinese heritage',
      aruba: 'Born and raised in Aruba',
      rotterdam: 'Rotterdam since eighteen'
    },
    work: {
      title: 'What I work with',
      caption: '1820: an electric current moved a compass needle.'
    },
    change: 'The same force that guided ships now stores data.',
    projects: 'Projects',
    tp: 'TP{n} · {label}',
    offduty: {
      title: 'Off duty',
      spin: 'What keeps me spinning'
    },
    qa: {
      title: 'Questions',
      items: [
        'What do you do now?',
        'What comes after MBO 4?',
        'Which roles interest you?',
        'Why these directions?',
        'Where does it lead?'
      ] satisfies QaItems
    },
    hello: 'Say hello',
    stills: {
      hero: 'A Chinese compass with a glowing yellow needle',
      china: 'The compass ring in Chinese red and gold',
      aruba: "The compass ring with Aruba's sea, flag stripes and star",
      rotterdam: 'The compass ring with the cables of the Erasmus bridge',
      drive: 'The compass turned into a hard drive, its tracks lit',
      offduty: "The drive's spindle, close up"
    },
    loader: 'FINDING NORTH · {n}%'
  }
};

export type Dictionary = typeof en;

/** The Q&A's questions: five, each answered in its place (src/data/qa.ts), so a translation must have exactly these five. */
export type QaItems = [string, string, string, string, string];
