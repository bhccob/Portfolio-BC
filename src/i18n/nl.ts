import type { Dictionary } from './en';

export const nl: Dictionary = {
  meta: {
    homeTitle: 'Bob Chung | Software engineering-student in Rotterdam',
    homeDescription:
      'Portfolio van Bob Chung, student software engineer in Rotterdam: game- en webprojecten, op weg naar systems- en firmware-security-engineering.',
    liteDescription: 'De lichte versie van het portfolio van Bob Chung: alle inhoud als gewone tekst, zonder 3D.',
    contactTitle: 'Contact opnemen',
    contactDescription: 'Stuur Bob Chung direct een bericht via zijn portfolio, of vind hem op GitHub en Instagram.',
    notFoundTitle: 'Pagina niet gevonden',
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
    // Bob confirms this Dutch wording in the milestone review.
    hakka: 'Hakka, een Chinees dialect, is mijn moedertaal.',
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
        text: 'Ik verdiep me in de specifieke vaardigheden die mijn mogelijke toekomstige rollen vragen, binnen engineering en cybersecurity: programmeren dicht op de hardware voor embedded systems, betrouwbare datapipelines bouwen, beveiliging integreren in elke fase van de ontwikkeling (DevSecOps) en automatiseren hoe firmware getest en beveiligd wordt.'
      },
      {
        status: 'Dagelijks',
        title: 'Werken met AI',
        text: 'Ik leer AI in mijn voordeel te gebruiken: om sneller onderzoek te doen, ideeën te prototypen en mijn werk te reviewen en testen, terwijl ik verantwoordelijk blijf voor elke regel die ik oplever.'
      },
      {
        status: 'Hierna',
        title: 'Nieuwsgierig naar',
        text: 'Elektronica en de hardware waarop software draait, en financiële technologie (fintech): hoe betaalsystemen, bankplatforms en financiële data ontworpen, beveiligd en betrouwbaar gehouden worden onder strikte regelgeving.'
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
    }
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
    roadmapNote: 'De rollen in de roadmap zijn mogelijke stappen in mijn loopbaan: richtingen die mij interesseren en waar ik naartoe werk, geen vaste plannen. Waar ze naartoe leiden, is een eigen bedrijf.',
    rolesToggle: 'Mogelijke toekomstige rollen',
    rolesHint: 'Interesses, geen vaste plannen',
    roleGroups: [
      {
        field: 'Engineering',
        roles: [
          {
            title: 'Embedded Engineer',
            text: 'Software ontwikkelen die direct op hardware draait, van microcontrollers tot verbonden apparaten, binnen strikte grenzen voor geheugen, energieverbruik en timing.'
          },
          {
            title: 'Data Engineer',
            text: 'De pipelines en databases ontwerpen die ruwe data omzetten in een betrouwbare basis voor analyses en beslissingen.'
          }
        ]
      },
      {
        field: 'Cybersecurity',
        roles: [
          {
            title: 'DevSecOps Engineer',
            text: 'Beveiliging integreren in elke fase van softwareontwikkeling en -oplevering, met geautomatiseerde tests van de eerste regel code tot de release.'
          }
        ]
      },
      {
        field: 'Engineering & cybersecurity',
        roles: [
          {
            title: 'Firmware Security Automation Engineer',
            text: 'De low-level code in apparaten beveiligen en automatiseren hoe die getest en geverifieerd wordt: embedded engineering en cybersecurity in één rol.'
          }
        ]
      }
    ],
    sector: {
      label: 'Mogelijke sector',
      title: 'Fintech',
      text: 'Deze vaardigheden zijn ook gewild in de financiële technologie, van beveiligde betaalterminals tot fraudedetectie: een sector waar deze route langs kan leiden, niet de bestemming zelf.'
    },
    goalStatus: 'Doel',
    goalRole: 'Een eigen bedrijf',
    goalOrg: 'Lange termijn · de bestemming',
    goalText:
      'Op de lange termijn wil ik een eigen technologiebedrijf oprichten. De rollen hierboven zijn de route ernaartoe: elk ervan bouwt de ervaring op in hardware, software, data en beveiliging waar zo’n bedrijf op steunt.',
    whyToggle: 'Waarom deze richtingen?',
    why: [
      'Deze richtingen hebben één ding gemeen: ze zijn onmisbaar voor de technologie waar de samenleving steeds meer op steunt. Naarmate verbonden apparaten, data en digitale diensten blijven groeien, groeit ook de vraag naar engineers die ze kunnen bouwen, beveiligen en automatiseren.',
      'Een aantal ervan reikt verder dan het scherm. Embedded- en firmwarewerk brengt software samen met elektrotechniek en werktuigbouwkunde: sensoren uitlezen, motoren en actuatoren aansturen en ontwerpen binnen de grenzen van schakelingen, energie en bewegende onderdelen. Het hele apparaat begrijpen, niet alleen de code, is wat mij in deze vakgebieden aantrekt.',
      'Ze passen bovendien bij mijn persoonlijkheid: ik werk het best wanneer ik me diep en ongestoord kan concentreren op complexe technische problemen. Deze rollen draaien om techniek in plaats van klantcontact en belonen precies die manier van werken.',
      'Bovenal leiden ze naar mijn doel op de lange termijn: een eigen technologiebedrijf oprichten. Elke rol is daar een bouwsteen voor: de elektronica en mechanica van een product, de software die erop draait, de data die het oplevert en de beveiliging die het beschermt.'
    ]
  },
  hood: {
    title: 'Deze site is <em>ook een project.</em>',
    intro: 'Twee talen, elk voor het werk waar ze het best in zijn: dezelfde mindset die ik wil meenemen naar systems- en firmwarewerk.',
    cards: [
      {
        lang: 'TypeScript · Astro',
        title: 'De site',
        text: 'Statische, SEO-vriendelijke pagina’s gegenereerd door Astro, met elke interactieve functie als TypeScript-klasse, inclusief dit bord.'
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
      time: 'lokale tijd in Rotterdam en op Aruba',
      lang: 'wissel van taal (en / nl)',
      clear: 'scherm leegmaken',
      exit: 'terminal sluiten'
    },
    whoami:
      'Bob Chung, {age}. Student software engineer in Rotterdam. Geboren op Aruba, Chinees van afkomst. Bouwt met nieuwsgierigheid, test met eerlijkheid.',
    careerNow: 'nu     → Student Software Engineer (MBO 4, Rotterdam)',
    careerHbo: 'hierna → HBO in technologie, na mijn MBO 4 (richting nog open)',
    careerNext: 'later  → mogelijk: Embedded · Data · DevSecOps · Firmware Security Automation',
    careerGoal: 'doel   → een eigen technologiebedrijf',
    opening: '{page} openen…',
    sudo: 'Toegang verleend. Je gaat naar de contactpagina…',
    moreSoon: '#03 volgende categorie: systems & security, onderweg…'
  },
  // Verbatim from the NL column of docs/art-direction.md § Copy budget (Bob approved it on 2026-10-20).
  needle: {
    hero: { name: 'BOB CHUNG', tagline: 'VOLG DE NAALD', scrollCue: 'Scroll' },
    loader: {
      caption: 'De naald zoekt het noorden',
      enterSilent: 'Binnenkomen zonder geluid',
      enterSound: 'Binnenkomen met geluid'
    },
    fallback: { title: 'DE NAALD IS HET NOORDEN KWIJT', lite: 'Open de lichte versie' },
    toggle: { label: '3D', on: '3D aan', off: '3D uit' },
    liteLink: 'Lichte versie',
    parts: {
      lid: { name: 'Deksel', line: 'Beschermt de wijzerplaat als het kompas reist.' },
      rim: { name: 'Rand met drakenreliëf', line: 'Houdt het glas vast en geeft de hand grip.' },
      crystal: { name: 'Glas', line: 'Houdt wind en stof weg van de naald.' },
      strings: { name: 'Rode richtdraden', line: 'Twee gekruiste draden lezen de richting af op de ringen.' },
      bagua: { name: 'Bagua-ring', line: 'Acht trigrammen verdelen de horizon in acht richtingen.' },
      degrees: { name: 'Graadring', line: '360 streepjes maken van een richting een getal.' },
      dial: { name: 'Hemelplaat', line: 'De draaiende schijf die je op een richting uitlijnt.' },
      jewel: { name: 'Draaisteen', line: 'Een harde steen laat de naald bijna wrijvingsloos draaien.' },
      needle: { name: 'Naald', line: 'Gemagnetiseerd staal dat zich naar het aardmagnetisch veld richt.' },
      plate: { name: 'Aardplaat', line: 'De vaste vierkante basis die het kompas waterpas houdt.' },
      housing: { name: 'Behuizing', line: 'Draagt alle ringen; zo meteen wordt dit de harde schijf.' }
    },
    morph: 'Dezelfde kracht die schepen stuurde, bewaart nu onze data.',
    project: { open: 'Openen', download: 'Downloaden', code: 'Code', back: 'Esc · terug' }
  },
  compass: {
    meta: {
      title: 'Kompasstudie | Bob Chung',
      description: 'Een voorproef van het vernieuwde portfolio: een kompas waarvan de naald je cursor volgt.'
    },
    role: 'Student software engineer · Rotterdam',
    hints: { scroll: 'Scroll', drag: 'Sleep om te draaien' },
    about: { title: 'Over mij' },
    homes: {
      china: 'Chinees van afkomst',
      aruba: 'Geboren en getogen op Aruba',
      rotterdam: 'Sinds mijn achttiende in Rotterdam'
    },
    work: {
      title: 'Waar ik mee werk',
      caption: '1820: een elektrische stroom liet een kompasnaald bewegen.'
    },
    change: 'Dezelfde kracht die schepen de weg wees, slaat nu data op.',
    projects: 'Projecten',
    tp: 'TP{n} · {label}',
    offduty: {
      title: 'Buiten dienst',
      spin: 'Wat mij draaiende houdt'
    },
    qa: {
      title: 'Vragen',
      items: [
        'Wat doe je nu?',
        'Wat komt er na MBO 4?',
        'Welke rollen interesseren je?',
        'Waarom deze richtingen?',
        'Waar leidt het naartoe?'
      ]
    },
    hello: 'Zeg hallo',
    stills: {
      hero: 'Een Chinees kompas met een gloeiende gele naald',
      china: 'De kompasring in Chinees rood en goud',
      aruba: 'De kompasring met de zee, de vlagstrepen en de ster van Aruba',
      rotterdam: 'De kompasring met de kabels van de Erasmusbrug',
      drive: 'Het kompas als harde schijf, met verlichte sporen',
      offduty: 'De spindel van de schijf, van dichtbij'
    },
    loader: 'ZOEKT HET NOORDEN · {n}%'
  }
};
