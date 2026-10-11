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
  board: {
    words: ['Vertrek', 'Departures', 'Salida'],
    phases: { night: 'Nachtdienst', dawn: 'Eerste licht', day: 'Dagdienst', dusk: 'Avonddienst' },
    rotterdam: 'Rotterdam',
    aruba: 'Oranjestad, Aruba',
    role: 'Student software engineer · Rotterdam',
    roleSpoken: 'Student software engineer in Rotterdam',
    echo: 'Hallo, {name} · welkom aan boord',
    columns: { year: 'Jaar', project: 'Project', line: 'Lijn', status: 'Status' },
    departed: 'Vertrokken',
    boarding: 'Instappen',
    held: 'Aan de gate',
    nextTitle: '#03 Volgende build',
    nextLine: 'In voorbereiding',
    earlierTitle: 'Eerder werk',
    earlierLine: 'Niet vermeld',
    line: 'Ik bouw met <em>nieuwsgierigheid</em> en test met <em>eerlijkheid</em>. Geboren op Aruba, Chinees van afkomst, gevestigd in Rotterdam.',
    typeHint: 'Typ iets: het bord spelt het',
    scroll: 'Scroll',
    drawing: 'BC-2006 · Schaal 1:1'
  },
  work: {
    title: 'Projecten, <em>build voor build.</em>',
    intro:
      'Elk project is een ander soort werk, dus elk rijdt op een eigen lijn: gameontwikkeling, webontwikkeling en wat er hierna instapt.',
    project: 'Project',
    line: 'Lijn',
    type: 'Type',
    year: 'Jaar',
    role: 'Rol',
    stack: 'Gebouwd met',
    status: 'Status',
    github: 'Bekijk op GitHub',
    caseStudy: 'Lees de case study',
    nextTitle: 'Volgende build <em>stapt bijna in.</em>',
    nextText:
      'Er komen meer projecten aan. Sommige zijn nog in ontwikkeling, andere wachten op publicatie. Volg tot die tijd mee op GitHub.',
    nextLink: 'Volg mij op GitHub',
    heldTitle: 'Aan de gate',
    heldText:
      'Er bestaan eerdere projecten, maar niet al mijn werk haalt dit bord. Alleen projecten die voldoen aan de standaard die ik voor dit portfolio hanteer, staan hier.'
  },
  about: {
    title: 'De route <em>tot nu toe.</em>',
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
    comfortable: 'Vertrouwd',
    comfortableNote: 'Gebruikt in afgeronde projecten',
    learning: 'Aan het leren',
    learningNote: 'Nu in uitvoering',
    exploring: 'Hierna te ontdekken',
    exploringNote: 'Richting systems en firmware',
    exploringItems: ['C', 'Python', 'Embedded systems', 'Elektronica']
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
    hint: 'Pak de objecten en gooi ze weg. Houd het pingpongballetje in de lucht.',
    hintTouch: 'Tik op de objecten. Houd het pingpongballetje in de lucht.',
    rally: 'Rally',
    best: 'Record',
    gravity: 'Zwaartekracht',
    gravityLabel: 'Zwaartekracht in de speeltuin aan- of uitzetten',
    rallyOver: 'Rally voorbij: {n} slagen',
    newBest: 'Nieuw rallyrecord: {n}!',
    playgroundLabel:
      'Interactieve speeltuin met lijntekeningen: een pingpongballetje, een halterschijf, wiskundige symbolen, een chip, een gamecontroller en een stopwatch. Pak ze, gooi ze en laat ze tegen de woorden stuiteren.'
  },
  career: {
    title: 'Huidige build <em>& roadmap.</em>',
    currentStatus: 'In dienst',
    currentRole: 'Student Software Engineer',
    currentOrg: 'MBO 4 · Rotterdam',
    currentText:
      'Ik bouw een brede softwarebasis op: gameontwikkeling in Godot, webontwikkeling, relationele databases en SQL, frameworks zoals Laravel en programmeerbasis in meerdere talen.',
    nextStatus: 'Mogelijk',
    roadmapNote: 'De rollen hieronder zijn mogelijke bestemmingen voor mijn toekomstige loopbaan: richtingen waar ik naartoe werk, geen vaste plannen.',
    roles: [
      {
        title: 'Systems Engineer',
        text: 'Het ontwerpen, integreren en onderhouden van de systemen waar al het andere op draait.'
      },
      {
        title: 'Firmware Security Automation Engineer',
        text: 'Het beveiligen van de low-level code in apparaten, en het automatiseren van hoe die getest en geverifieerd wordt.'
      }
    ],
    whyToggle: 'Waarom deze richting?',
    why:
      'Beide vakgebieden zijn toekomstbestendig: naarmate verbonden apparaten en kritieke infrastructuur toenemen, groeit ook de vraag naar engineers die ze kunnen beveiligen en automatiseren. Ze belonen diepe, ongestoorde focus op complexe technische problemen, in rollen die draaien om techniek in plaats van klantcontact. Daarnaast bieden ze sterke vooruitzichten en een solide basis om later een eigen bedrijf op te bouwen.'
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
      generic: 'Er ging iets mis bij het versturen. Probeer het opnieuw, of mail mij direct op bhccob@gmail.com.'
    },
    successTitle: 'Bericht verzonden.',
    successText: 'Bedankt voor je bericht. Ik reageer zo snel mogelijk.',
    again: 'Nog een bericht sturen',
    mailtoTitle: 'Bijna klaar.',
    mailtoText: 'Je e-mailprogramma zou nu moeten openen met het bericht klaar om te versturen.'
  },
  project: {
    back: 'Alle projecten',
    overview: 'Overzicht',
    build: 'Hoe het gebouwd is',
    focus: 'Focus',
    next: 'Volgend project',
    moreTitle: 'Er komen <em>meer projecten aan.</em>',
    moreText: 'Nieuw werk is in ontwikkeling of wacht op publicatie.',
    moreLink: 'Terug naar alle projecten'
  },
  footer: {
    made: 'Met nieuwsgierigheid gebouwd in Rotterdam',
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
      projects: 'toon projecten',
      career: 'huidige build & roadmap',
      socials: 'waar je mij vindt',
      contact: 'open de contactpagina',
      rally: 'toon je beste pingpongrally',
      gravity: 'zwaartekracht in de speeltuin aan/uit',
      time: 'lokale tijd in Rotterdam en op Aruba',
      lang: 'wissel van taal (en / nl)',
      clear: 'scherm leegmaken',
      exit: 'terminal sluiten'
    },
    whoami:
      'Bob Chung, {age}. Student software engineer in Rotterdam. Geboren op Aruba, Chinees van afkomst. Bouwt met nieuwsgierigheid, test met eerlijkheid.',
    careerNow: 'nu     → Student Software Engineer (MBO 4, Rotterdam)',
    careerNext: 'straks → mogelijk: Systems Engineer · Firmware Security Automation Engineer',
    rallyBest: 'Beste rally: {n} slagen.',
    rallyNone: 'Nog geen rally. Sla het pingpongballetje in de speeltuin onder ‘Buiten dienst’!',
    gravityOn: 'Zwaartekracht aan. Alles valt.',
    gravityOff: 'Zwaartekracht uit. Alles zweeft weer.',
    gravityElsewhere: 'Zwaartekracht bestaat alleen in de speeltuin. Ga eerst naar de homepagina.',
    opening: '{page} openen…',
    sudo: 'Toegang verleend. Je gaat naar de contactpagina…',
    moreSoon: '#03  volgende build stapt bijna in…'
  },
  toast: {
    konami: '↑↑↓↓←→←→BA: ballenregen!',
    konamiElsewhere: 'Cheatcode geaccepteerd. Ga naar de homepagina om het te zien.'
  }
};
