/**
 * English copy. This object defines the shape of every dictionary:
 * `nl.ts` is typed against it, so a missing Dutch key fails type-checking.
 * Strings that contain markup are rendered with `set:html` and only ever
 * come from this file, never from user input.
 */
export const en = {
  meta: {
    homeTitle: 'Bob Chung | Student Software Engineer in Rotterdam',
    homeDescription:
      'Portfolio of Bob Chung, a student software engineer in Rotterdam: game and web projects, and a route toward systems and firmware security engineering.',
    contactTitle: 'Contact | Bob Chung',
    contactDescription: 'Send Bob Chung a message straight from his portfolio, or find him on GitHub and Instagram.',
    notFoundTitle: 'Page not found | Bob Chung',
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
    hello: 'Hey, I’m Bob Chung',
    lines: ['I build with', 'curiosity', '& test with', 'honesty'],
    spoken: 'I build with curiosity and test with honesty.',
    role: 'Student software engineer · Rotterdam, NL',
    badge: 'Student software engineer • Born in Aruba • Based in Rotterdam • ',
    ball: 'Play ping-pong',
    scroll: 'Scroll down'
  },
  work: {
    title: 'Projects, <em>one build at a time.</em>',
    intro:
      'Each project is a different kind of job, so each one has its own page. Pick a card to see what it is, how it was built and what I focused on.',
    project: 'Project',
    category: 'Category',
    type: 'Type',
    year: 'Year',
    role: 'Role',
    stack: 'Built with',
    status: 'Status',
    github: 'View on GitHub',
    caseStudy: 'Read the case study',
    view: 'View project',
    soon: 'Coming soon',
    rail: 'Projects',
    nextTitle: 'Next build <em>on the way.</em>',
    nextText:
      'More projects are on the way. Some are still in progress; others are waiting to be published. Follow along on GitHub in the meantime.',
    nextLink: 'Follow on GitHub',
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
        text: 'Deepening the more specific skills that my possible future roles call for, from systems and firmware security to security engineering, data engineering, MLOps and site reliability engineering (SRE): working closer to the hardware, understanding how systems fit together, and testing, securing and operating software.'
      },
      {
        status: 'Daily',
        title: 'Working with AI',
        text: 'Learning to use AI to my advantage: to research faster, prototype ideas, and review and test my work, while remaining responsible for every line I deliver.'
      },
      {
        status: 'Next',
        title: 'Curious about',
        text: 'Embedded systems and electronics, where software meets the hardware it runs on, and how machine-learning systems, data platforms and large online services are secured and kept running: MLOps, data engineering, security and SRE.'
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
    },
    playTitle: 'Train · Run · Play',
    hint: 'Grab and throw the objects. Keep the ping-pong ball in the air.',
    hintTouch: 'Tap the objects. Keep the ping-pong ball in the air.',
    rally: 'Rally',
    best: 'Best',
    gravity: 'Gravity',
    gravityLabel: 'Toggle gravity in the playground',
    rallyOver: 'Rally over: {n} hits',
    newBest: 'New best rally: {n}!',
    playgroundLabel:
      'Interactive playground with line-art objects: a ping-pong ball, a weight plate, maths symbols, a chip, a game controller and a stopwatch. Grab, throw and bounce them off the words.'
  },
  career: {
    title: 'Current build <em>& roadmap.</em>',
    currentStatus: 'In service',
    currentRole: 'Student Software Engineer',
    currentOrg: 'MBO 4 · Rotterdam',
    currentText:
      'Building a broad software foundation: game development in Godot, web development, relational databases and SQL, frameworks such as Laravel, and programming fundamentals across several languages.',
    nextStatus: 'Possible',
    roadmapNote: 'The roles in the roadmap are possible destinations for my future career: directions I am interested in and working toward, not fixed plans.',
    rolesToggle: 'Possible future roles',
    rolesHint: 'Interests, not fixed plans',
    roles: [
      {
        title: 'Systems Engineer',
        text: 'Designing, integrating and maintaining the systems that everything else runs on.'
      },
      {
        title: 'Firmware Security Automation Engineer',
        text: 'Securing the low-level code inside devices, and automating how it is tested and verified.'
      },
      {
        title: 'Security Engineer',
        text: 'Protecting systems and data by finding weaknesses early and building defences into the design.'
      },
      {
        title: 'Site Reliability Engineer (SRE)',
        text: 'Keeping large services fast, stable and available through automation and careful monitoring.'
      },
      {
        title: 'Data Engineer',
        text: 'Building the pipelines and databases that turn raw data into something reliable to work with.'
      },
      {
        title: 'MLOps Engineer',
        text: 'Bringing machine-learning models into production and keeping them reliable, measurable and up to date.'
      }
    ],
    whyToggle: 'Why these directions?',
    why:
      'They share one thread: they are built to last. As connected devices, data and online services keep growing, so does the need for engineers who can secure, automate and keep them running. These roles reward deep, uninterrupted focus on complex technical problems and are engineering-driven rather than client-facing. They also offer strong long-term prospects and a solid foundation for one day building a company of my own.'
  },
  hood: {
    title: 'This site is <em>a project too.</em>',
    intro: 'Three languages, each doing the job it does best: the same mindset I want to bring to systems and firmware work.',
    cards: [
      {
        lang: 'TypeScript · Astro',
        title: 'The site',
        text: 'Static, SEO-friendly pages generated by Astro, with every interactive feature written as a TypeScript class, including this board.'
      },
      {
        lang: 'C · WebAssembly',
        title: 'The physics',
        text: 'The off-duty playground runs on a small physics engine written in C and compiled to WebAssembly.'
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
      generic: 'Something went wrong while sending. Please try again, or email me directly at bhccob@gmail.com.'
    },
    successTitle: 'Message sent.',
    successText: 'Thank you for reaching out. I’ll reply as soon as I can.',
    again: 'Send another message',
    mailtoTitle: 'Almost there.',
    mailtoText: 'Your email app should open with the message ready to send.'
  },
  project: {
    back: 'All projects',
    overview: 'Overview',
    build: 'How it’s built',
    focus: 'Focus',
    next: 'Next project',
    moreTitle: 'More projects <em>are on the way.</em>',
    moreText: 'New work is in progress or waiting to be published.',
    moreLink: 'Back to all projects'
  },
  footer: {
    made: 'Built with curiosity in Rotterdam',
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
      projects: 'list projects',
      career: 'current build & roadmap',
      socials: 'where to find me',
      contact: 'open the contact page',
      rally: 'show your best ping-pong rally',
      gravity: 'toggle gravity in the playground',
      time: 'local time in Rotterdam and Aruba',
      lang: 'switch language (en / nl)',
      clear: 'clear the screen',
      exit: 'close the terminal'
    },
    whoami:
      'Bob Chung, {age}. Student software engineer in Rotterdam. Born in Aruba, Chinese by heritage. Builds with curiosity, tests with honesty.',
    careerNow: 'now   → Student Software Engineer (MBO 4, Rotterdam)',
    careerNext: 'next  → possible: Systems · Firmware Security Automation · Security · SRE · Data · MLOps',
    rallyBest: 'Best rally: {n} hits.',
    rallyNone: 'No rally yet. Hit the ping-pong ball in the off-duty playground!',
    gravityOn: 'Gravity enabled. Everything drops.',
    gravityOff: 'Gravity disabled. Back to floating.',
    gravityElsewhere: 'Gravity lives in the playground. Go to the home page first.',
    opening: 'Opening {page}…',
    sudo: 'Permission granted. Redirecting you to the contact page…',
    moreSoon: '#03  next build on the way…'
  },
  toast: {
    konami: '↑↑↓↓←→←→BA: ball storm!',
    konamiElsewhere: 'Cheat code accepted. Visit the home page to see it.'
  }
};

export type Dictionary = typeof en;
