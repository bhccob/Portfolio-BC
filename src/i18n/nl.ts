import type { Dictionary } from './en';

export const nl: Dictionary = {
  meta: {
    homeTitle: 'Bob Chung | Software engineering-student in Rotterdam',
    homeDescription:
      'Portfolio van Bob Chung, student software engineer in Rotterdam: game- en webprojecten, op weg naar systems- en firmware-security-engineering.',
    contactTitle: 'Contact opnemen | Bob Chung',
    contactDescription: 'Stuur Bob Chung direct een bericht via zijn portfolio, of vind hem op GitHub en Instagram.',
    notFoundTitle: 'Pagina niet gevonden | Bob Chung',
    notFoundDescription: 'Deze pagina bestaat niet. Ga terug naar het portfolio van Bob Chung.'
  },
  nav: {
    work: 'Werk',
    about: 'Over mij',
    career: 'Loopbaan',
    contact: 'Contact',
    send: 'Stuur een bericht',
    menu: 'Menu',
    close: 'Menu sluiten',
    terminal: 'Terminal openen',
    skip: 'Direct naar de inhoud',
    language: 'Taal',
    switchTo: 'View this page in English',
    home: 'Bob Chung, terug naar home'
  },
  loader: {
    label: 'Portfolio laden',
    status: 'Vertrekbord wordt geladen',
    skip: 'Klik of druk op een toets om over te slaan'
  },
  hero: {
    hello: 'Hoi, ik ben',
    name: ['Bob', 'Chung'],
    motto: [
      ['Ik bouw met', 'fat'],
      ['nieuwsgierigheid', 'light'],
      ['& test met', 'fat'],
      ['eerlijkheid.', 'light']
    ],
    role: 'Student software engineer · Rotterdam, NL',
    hint: 'Beweeg over mijn naam',
    hintTouch: 'Tik op mijn naam',
    badge: 'Student software engineer • Geboren op Aruba • Woont in Rotterdam • ',
    scroll: 'Scroll omlaag'
  },
  work: {
    title: 'Projecten, <em>build voor build.</em>',
    intro:
      'Mijn projecten zijn ingedeeld per vakgebied. Kies een categorie om de projecten te bekijken: wat elk project is, hoe het gebouwd is en waar ik op focuste.',
    countOne: '1 project',
    countMany: '{n} projecten',
    categoryLabel: 'Categorie',
    project: 'Project',
    category: 'Categorie',
    type: 'Type',
    year: 'Jaar',
    role: 'Rol',
    stack: 'Gebouwd met',
    status: 'Status',
    github: 'Bekijk op GitHub',
    caseStudy: 'Lees de case study',
    view: 'Bekijk projecten',
    soon: 'Onderweg',
    rail: 'Projecten',
    nextTitle: 'Volgende categorie: <em>systems & security.</em>',
    nextText:
      'De richtingen die ik verken, lopen naar systems en security. Zodra projecten op dat gebied klaar zijn, krijgen ze hier een eigen categorie.',
    nextLink: 'Bekijk de roadmap',
    heldTitle: 'Niet alles staat hier',
    heldText:
      'Er bestaan eerdere projecten, maar alleen werk dat voldoet aan de standaard die ik voor dit portfolio hanteer, komt op deze pagina.'
  },
  about: {
    title: 'De route <em>tot nu toe.</em>',
    mixed: [
      ['Ik ben Bob,', 'fat'],
      ['een', 'light'],
      ['{age}-jarige', 'fat-yellow'],
      ['student', 'caps'],
      ['software engineer.', 'fat'],
      ['Geboren en getogen op', 'light'],
      ['Aruba,', 'fat'],
      ['Chinees', 'fat-yellow'],
      ['van afkomst,', 'light'],
      ['en sinds mijn achttiende in', 'caps'],
      ['Rotterdam.', 'fat']
    ],
    lead:
      'Ik ben Bob Chung, een <span data-age>{age}</span>-jarige student software engineer in Rotterdam. Geboren en getogen op Aruba en Chinees van afkomst; op mijn achttiende verhuisde ik naar Nederland.',
    body:
      'Ik werk aan databases, gameontwikkeling en webontwikkeling, en elke discipline scherpt de andere aan. Hardware en elektrotechniek zijn de volgende haltes op mijn route. Ik bouw met nieuwsgierigheid en test met eerlijkheid.',
    quote: 'Thuis is voor mij niet één plek. Het is een mix van culturen en de vragen die ik blijf najagen.',
    thoughtLabel: 'Een regel die ik volg',
    thought: '“Overdenken is angst die zich voordoet als logica.”',
    portraitAlt: 'Portret van Bob Chung',
    facts: {
      age: 'Leeftijd',
      born: 'Geboren',
      bornValue: 'Aruba',
      heritage: 'Afkomst',
      heritageValue: 'Chinees',
      based: 'Woont in',
      basedValue: 'Rotterdam, NL',
      studying: 'Opleiding',
      studyingValue: 'MBO 4, Rotterdam'
    },
    route: {
      label: 'Herkomstroute',
      heritage: 'Afkomst',
      heritagePlace: 'China',
      born: 'Geboren & getogen',
      bornPlace: 'Aruba',
      now: 'Sinds mijn achttiende',
      nowPlace: 'Rotterdam'
    },
    clock: {
      label: 'Lokale tijd',
      apart: '{h} uur verschil'
    }
  },
  skills: {
    title: 'Waar ik mee <em>werk.</em>',
    statement: [
      ['Een stevige', 'light'],
      ['full-stack', 'fat-yellow'],
      ['basis,', 'fat'],
      ['aangescherpt richting', 'light'],
      ['systems', 'fat'],
      ['en', 'light'],
      ['firmware,', 'fat'],
      ['versneld door', 'caps'],
      ['AI', 'fat-yellow'],
      ['en nieuwsgierig naar', 'light'],
      ['hardware.', 'fat']
    ],
    statementSpoken: 'Een stevige full-stack basis, aangescherpt richting systems en firmware, versneld door AI en nieuwsgierig naar hardware.',
    rows: [
      {
        status: 'Stevig',
        title: 'Full-stack basis',
        text: 'Een gedegen beheersing van de basisprogrammeertalen, relationele databases met SQL, gameontwikkeling in Godot en moderne frameworks: genoeg om een project te bouwen van de database tot en met de interface.'
      },
      {
        status: 'Bezig',
        title: 'Specialiseren',
        text: 'Ik verdiep me in de specifiekere vaardigheden die mijn mogelijke toekomstige rollen vragen, van systems en firmware security tot security engineering, data engineering, MLOps en site reliability engineering (SRE): dichter bij de hardware werken, begrijpen hoe systemen samenwerken, en software testen, beveiligen en beheren.'
      },
      {
        status: 'Dagelijks',
        title: 'Werken met AI',
        text: 'Ik leer AI in mijn voordeel te gebruiken: om sneller onderzoek te doen, ideeën te prototypen en mijn werk te reviewen en testen, terwijl ik verantwoordelijk blijf voor elke regel die ik oplever.'
      },
      {
        status: 'Hierna',
        title: 'Nieuwsgierig naar',
        text: 'Embedded systems en elektronica, waar software de hardware ontmoet waarop ze draait, en hoe machine-learningsystemen, dataplatforms en grote online diensten beveiligd en draaiende gehouden worden: MLOps, data engineering, security en SRE.'
      }
    ]
  },
  life: {
    title: 'Buiten <em>dienst.</em>',
    text: 'Buiten het programmeren blijf ik in beweging. Ik ben oud-powerlifter en oud-tafeltennisser; tegenwoordig hardloop ik, train ik in de sportschool en game ik om fit, gefocust en in balans te blijven.',
    current: 'Nu',
    former: 'Vroeger',
    hobbies: {
      running: 'Hardlopen',
      runningText: 'Uithoudingsvermogen en een helder hoofd.',
      gym: 'Sportschool',
      gymText: 'Kracht, stap voor stap opgebouwd.',
      gaming: 'Gamen',
      gamingText: 'Spelen, met oog voor goed gamedesign.',
      powerlifting: 'Powerliften',
      tableTennis: 'Tafeltennis'
    },
    playTitle: 'Train · Ren · Speel',
    hint: 'Druk op Start, houd het pingpongballetje met je muis in de lucht en speel het door de ringen. Je hebt 60 seconden.',
    hintTouch: 'Druk op Start, tik het pingpongballetje omhoog en speel het door de ringen. Je hebt 60 seconden.',
    hintPlaying: 'Gouden ringen geven 5 seconden extra. Raakt de bal de grond, dan begint je combo opnieuw.',
    start: 'Start trickshots',
    time: 'Tijd',
    score: 'Score',
    combo: 'Combo',
    best: 'Record',
    go: 'Go!',
    resultTitle: 'Tijd!',
    result: '{score} punten, {rings} ringen, beste combo ×{combo}',
    newBest: 'Nieuw record: {n} punten!',
    bestScore: 'Jouw record: {n} punten',
    again: 'Opnieuw spelen',
    close: 'Sluiten',
    sound: 'Geluid',
    soundLabel: 'Geluid van de minigame',
    gravity: 'Zwaartekracht',
    gravityLabel: 'Zwaartekracht in de speeltuin',
    playgroundLabel:
      'Minigame: houd een pingpongballetje in de lucht en speel het binnen 60 seconden door ringen. Lijntekeningen (een halterschijf, wiskundige symbolen, een chip, een gamecontroller en een stopwatch) zweven rond de woorden en kun je pakken en gooien.'
  },
  career: {
    title: 'Huidige build <em>& roadmap.</em>',
    currentStatus: 'In dienst',
    currentRole: 'Student Software Engineer',
    currentOrg: 'MBO 4 · Rotterdam',
    currentText:
      'Ik bouw een brede softwarebasis op: gameontwikkeling in Godot, webontwikkeling, relationele databases en SQL, frameworks zoals Laravel en programmeerbasis in meerdere talen.',
    hboStatus: 'Hierna',
    hboRole: 'HBO · Technologie',
    hboOrg: 'Na mijn MBO 4 · richting nog open',
    hboText:
      'Na mijn MBO 4 wil ik doorstromen naar het HBO, in een technische richting. Welke opleiding het precies wordt, kies ik nog; richtingen als HBO-ICT, Technische Informatica of Embedded Systems Engineering sluiten aan bij de rollen waar ik naartoe werk.',
    nextStatus: 'Mogelijk',
    roadmapNote: 'De rollen in de roadmap zijn mogelijke bestemmingen voor mijn toekomstige loopbaan: richtingen die mij interesseren en waar ik naartoe werk, geen vaste plannen.',
    rolesToggle: 'Mogelijke toekomstige rollen',
    rolesHint: 'Interesses, geen vaste plannen',
    roles: [
      {
        title: 'Systems Engineer',
        text: 'Het ontwerpen, integreren en onderhouden van de systemen waar al het andere op draait.'
      },
      {
        title: 'Firmware Security Automation Engineer',
        text: 'Het beveiligen van de low-level code in apparaten, en het automatiseren van hoe die getest en geverifieerd wordt.'
      },
      {
        title: 'Security Engineer',
        text: 'Systemen en data beschermen door zwakke plekken vroeg te vinden en beveiliging in het ontwerp in te bouwen.'
      },
      {
        title: 'Site Reliability Engineer (SRE)',
        text: 'Grote diensten snel, stabiel en beschikbaar houden met automatisering en zorgvuldige monitoring.'
      },
      {
        title: 'Data Engineer',
        text: 'De pipelines en databases bouwen die ruwe data omzetten in iets betrouwbaars om mee te werken.'
      },
      {
        title: 'MLOps Engineer',
        text: 'Machine-learningmodellen in productie brengen en ze betrouwbaar, meetbaar en actueel houden.'
      }
    ],
    whyToggle: 'Waarom deze richtingen?',
    why:
      'Ze hebben één ding gemeen: ze zijn toekomstbestendig. Naarmate verbonden apparaten, data en online diensten blijven groeien, groeit ook de vraag naar engineers die ze kunnen beveiligen, automatiseren en draaiende houden. Deze rollen belonen diepe, ongestoorde focus op complexe technische problemen en draaien om techniek in plaats van klantcontact. Daarnaast bieden ze sterke vooruitzichten en een solide basis om later een eigen bedrijf op te bouwen.'
  },
  hood: {
    title: 'Deze site is <em>ook een project.</em>',
    intro: 'Drie talen, elk voor het werk waar ze het best in zijn: dezelfde mindset die ik wil meenemen naar systems- en firmwarewerk.',
    cards: [
      {
        lang: 'TypeScript · Astro',
        title: 'De site',
        text: 'Statische, SEO-vriendelijke pagina’s gegenereerd door Astro, met elke interactieve functie als TypeScript-klasse, inclusief dit bord.'
      },
      {
        lang: 'C · WebAssembly',
        title: 'De physics',
        text: 'De speeltuin onder ‘Buiten dienst’ draait op een kleine physics-engine, geschreven in C en gecompileerd naar WebAssembly.'
      },
      {
        lang: 'Python',
        title: 'De deploy-bewaker',
        text: 'Voor elke deploy controleert een Python-auditor de titels, beschrijvingen, links en alt-teksten van elke pagina, en stopt de release als er iets niet klopt.'
      }
    ]
  },
  cta: {
    title: 'Laatste oproep: <em>zeg hallo.</em>',
    text: 'Vragen, kansen of gewoon een hallo: mijn inbox staat open.',
    button: 'Stuur mij een bericht',
    or: 'Of vind mij op'
  },
  contact: {
    title: 'Stuur een <em>bericht.</em>',
    intro: 'Heb je een vraag, een kans of wil je gewoon hallo zeggen? Schrijf het hieronder en het komt in mijn inbox terecht.',
    direct: 'Of bereik mij direct',
    formTitle: 'Jouw bericht',
    name: 'Naam',
    namePlaceholder: 'Je naam',
    email: 'E-mail',
    emailPlaceholder: 'jij@voorbeeld.nl',
    subject: 'Onderwerp',
    subjectPlaceholder: 'Waar gaat het over?',
    optional: 'optioneel',
    message: 'Bericht',
    messagePlaceholder: 'Schrijf je bericht…',
    send: 'Bericht versturen',
    sending: 'Versturen…',
    privacy: 'Je gegevens worden alleen gebruikt om op je bericht te reageren.',
    errors: {
      name: 'Vul je naam in.',
      email: 'Vul een geldig e-mailadres in.',
      message: 'Je bericht moet minstens 10 tekens bevatten.',
      generic: 'Er ging iets mis bij het versturen. Probeer het opnieuw, of mail mij direct op bhccob@gmail.com.',
      cooldown: 'Je bericht is net verstuurd. Wacht een minuut voordat je een volgend bericht stuurt.'
    },
    successTitle: 'Bericht verzonden.',
    successText: 'Bedankt voor je bericht. Ik reageer zo snel mogelijk.',
    again: 'Nog een bericht sturen',
    mailtoTitle: 'Bijna klaar.',
    mailtoText: 'Je e-mailprogramma zou nu moeten openen met het bericht klaar om te versturen.'
  },
  project: {
    back: 'Alle categorieën',
    shelf: 'Projecten in {category}',
    previous: 'Vorige',
    next: 'Volgende',
    position: '{n} van {total}',
    keys: 'Gebruik ← en → om van project te wisselen',
    overview: 'Overzicht',
    build: 'Hoe het gebouwd is',
    focus: 'Focus',
    alsoSee: 'Ook bekijken',
    moreTitle: 'Er komen <em>meer projecten aan.</em>',
    moreText: 'Nieuw werk is in ontwikkeling of wacht op publicatie, en eerdere projecten die niet aan mijn standaard voldoen, staan hier niet.',
    moreLink: 'Terug naar alle categorieën'
  },
  footer: {
    made: 'Met nieuwsgierigheid gebouwd in Rotterdam',
    analytics: 'Anonieme bezoekersstatistieken, zonder cookies.',
    top: 'Terug naar boven',
    terminalHint: 'Druk op <kbd>/</kbd> om de terminal te openen'
  },
  notFound: {
    status: 'Vervallen',
    title: 'Deze pagina is <em>vervallen.</em>',
    text: 'De pagina die je zoekt bestaat niet (meer). De site is opnieuw gebouwd, dus sommige oude links zijn verplaatst.',
    home: 'Terug naar het vertrekbord'
  },
  terminal: {
    title: 'bob@rotterdam: ~',
    placeholder: 'Typ een commando, bijv. help',
    welcome: 'Welkom bij bob-shell. Typ “help” om te zien wat ik kan.',
    notFound: 'commando niet gevonden: {cmd}. Probeer “help”.',
    help: {
      help: 'toon beschikbare commando’s',
      whoami: 'wie is Bob?',
      projects: 'toon projecten per categorie',
      career: 'huidige build & roadmap',
      socials: 'waar je mij vindt',
      contact: 'open de contactpagina',
      rally: 'toon je beste trickshotscore',
      gravity: 'zwaartekracht in de speeltuin aan/uit',
      time: 'lokale tijd in Rotterdam en op Aruba',
      lang: 'wissel van taal (en / nl)',
      clear: 'scherm leegmaken',
      exit: 'terminal sluiten'
    },
    whoami:
      'Bob Chung, {age}. Student software engineer in Rotterdam. Geboren op Aruba, Chinees van afkomst. Bouwt met nieuwsgierigheid, test met eerlijkheid.',
    careerNow: 'nu     → Student Software Engineer (MBO 4, Rotterdam)',
    careerHbo: 'hierna → HBO in technologie, na mijn MBO 4 (richting nog open)',
    careerNext: 'later  → mogelijk: Systems · Firmware Security Automation · Security · SRE · Data · MLOps',
    rallyBest: 'Beste trickshotscore: {n} punten.',
    rallyNone: 'Nog geen score. Speel trickshots in de speeltuin onder ‘Buiten dienst’!',
    gravityOn: 'Zwaartekracht aan. Alles valt.',
    gravityOff: 'Zwaartekracht uit. Alles zweeft weer.',
    gravityElsewhere: 'Zwaartekracht bestaat alleen in de speeltuin. Ga eerst naar de homepagina.',
    opening: '{page} openen…',
    sudo: 'Toegang verleend. Je gaat naar de contactpagina…',
    moreSoon: '#03 volgende categorie: systems & security, onderweg…'
  },
  toast: {
    konami: '↑↑↓↓←→←→BA: ballenregen!',
    konamiElsewhere: 'Cheatcode geaccepteerd. Ga naar de homepagina om het te zien.'
  }
};
