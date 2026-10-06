class SettingsStore {
  constructor(storage) {
    this.storage = storage;
  }

  get(key, fallback = null) {
    return this.storage.getItem(key) ?? fallback;
  }

  set(key, value) {
    this.storage.setItem(key, value);
  }
}

class ThemeController {
  constructor(button, documentRoot, settings) {
    this.button = button;
    this.documentRoot = documentRoot;
    this.settings = settings;
    this.storageKey = 'bob-portfolio-theme';
    this.initialize();
  }

  initialize() {
    const savedTheme = this.settings.get(this.storageKey);
    if (savedTheme === 'dark') this.documentRoot.body.classList.add('dark');
    this.button.addEventListener('click', () => this.toggle());
  }

  toggle() {
    const isDark = this.documentRoot.body.classList.toggle('dark');
    this.settings.set(this.storageKey, isDark ? 'dark' : 'light');
  }
}

class LanguageController {
  constructor(select, documentRoot, settings) {
    this.select = select;
    this.documentRoot = documentRoot;
    this.settings = settings;
    this.storageKey = 'bob-portfolio-language';
    this.translations = {
      en: { navWork:'Work', navAbout:'About', navContact:'Contact', available:'Available for selected collaborations', heroLine1:'Building bright', heroLine2:'digital worlds.', heroIntro:'A curious programmer from Aruba, now learning and building in Rotterdam.', scroll:'Scroll to explore', selectedWork:'Selected work', workTitle:'Things I make<br />with intent.', projectNote:'A home for future experiments, selected builds, and learning in public.', aboutLabel:'The person behind it', aboutTitle:'Learning the craft,<br /><em>one useful thing</em> at a time.', aboutText:'Chinese by blood. Raised in Aruba. Now studying in the Netherlands. I move between design, games, and database. Each one teaches me something the others don\'t. I build with curiosity and test with honesty. Home isn\'t one place for me. It\'s a mix of cultures and questions I keep chasing.', daily:'Comfortable', comfortable:'Learning', portrait:'Your portrait<br />goes here', offScreen:'Off screen', lifeTitle:'A good life<br />needs <em>momentum.</em>', lifeCurrent:'<span>INTERESTS</span> Staying active, gaming, and learning', lifeOccupation:'<span>OCCUPATION</span> MBO 4 Student', contactLabel:'Let us make something', contactTitle:'Have an idea?<br /><em>Say hello.</em>', backTop:'Back to top ↑', footer:'Made with curiosity in Rotterdam' },
      nl: { navWork:'Werk', navAbout:'Over mij', navContact:'Contact', available:'Beschikbaar voor geselecteerde samenwerkingen', heroLine1:'Ik bouw heldere', heroLine2:'digitale werelden.', heroIntro:'Een nieuwsgierige ontwerper en ontwikkelaar uit Aruba, nu lerend en bouwend in Rotterdam.', scroll:'Ontdek meer', selectedWork:'Geselecteerd werk', workTitle:'Dingen die ik maak<br />met intentie.', projectNote:'Een plek voor toekomstige experimenten, projecten en leren in het openbaar.', aboutLabel:'De persoon erachter', aboutTitle:'Het vak leren,<br /><em>een bruikbaar ding</em> tegelijk.', aboutText:'Chinees van bloed, 18 jaar opgegroeid in Aruba en nu studerend in Nederland. Ik ben een eerlijke, gepassioneerde leerling tussen ontwerp, games en veiligheid.', daily:'Dagelijks', comfortable:'Vertrouwd met', portrait:'Jouw portret<br />komt hier', offScreen:'Buiten beeld', lifeTitle:'Een goed leven<br />vraagt <em>beweging.</em>', lifeCurrent:'<span>INTERESSES</span> Actief blijven, gamen en leren', lifeOccupation:'<span>BEROEP</span> MBO 4-student', contactLabel:'Laten we iets maken', contactTitle:'Een idee?<br /><em>Zeg hallo.</em>', backTop:'Naar boven ↑', footer:'Met nieuwsgierigheid gemaakt in Rotterdam' },
      zh: { navWork:'作品', navAbout:'关于我', navContact:'联系', available:'接受精选合作', heroLine1:'构建明亮的', heroLine2:'数字世界。', heroIntro:'来自阿鲁巴的好奇设计师与开发者，现在在鹿特丹学习和创作。', scroll:'向下探索', selectedWork:'精选作品', workTitle:'带着想法<br />创作的作品。', projectNote:'未来实验、精选项目和公开学习的空间。', aboutLabel:'背后的我', aboutTitle:'学习技艺，<br /><em>一次做好一件事。</em>', aboutText:'血统是华人，在阿鲁巴成长了18年，现在在荷兰学习。我诚实、热情，正在设计、游戏与网络安全之间寻找方向。', daily:'日常使用', comfortable:'熟悉使用', portrait:'你的肖像<br />放在这里', offScreen:'屏幕之外', lifeTitle:'好生活<br />需要<em>动力。</em>', lifeCurrent:'<span>兴趣</span> 保持活力、游戏和学习', lifeOccupation:'<span>职业</span> MBO 4 学生', contactLabel:'一起创造些东西', contactTitle:'有个想法？<br /><em>来打个招呼。</em>', backTop:'回到顶部 ↑', footer:'在鹿特丹用好奇心制作' },
      es: { navWork:'Trabajo', navAbout:'Sobre mí', navContact:'Contacto', available:'Disponible para colaboraciones seleccionadas', heroLine1:'Construyendo brillantes', heroLine2:'mundos digitales.', heroIntro:'Un diseñador y desarrollador curioso de Aruba, aprendiendo y creando ahora en Róterdam.', scroll:'Explorar', selectedWork:'Trabajo seleccionado', workTitle:'Cosas que hago<br />con intención.', projectNote:'Un hogar para experimentos, proyectos seleccionados y aprender en público.', aboutLabel:'La persona detrás', aboutTitle:'Aprendiendo el oficio,<br /><em>una cosa útil</em> a la vez.', aboutText:'Chino de sangre, crecí 18 años en Aruba y ahora estudio en los Países Bajos. Soy un aprendiz honesto y apasionado entre diseño, juegos y seguridad.', daily:'Diario', comfortable:'Cómodo con', portrait:'Tu retrato<br />va aquí', offScreen:'Fuera de pantalla', lifeTitle:'Una buena vida<br />necesita <em>impulso.</em>', lifeCurrent:'<span>INTERESES</span> Mantenerse activo, videojuegos y aprender', lifeOccupation:'<span>OCUPACIÓN</span> Estudiante de MBO 4', contactLabel:'Hagamos algo', contactTitle:'¿Una idea?<br /><em>Di hola.</em>', backTop:'Volver arriba ↑', footer:'Hecho con curiosidad en Róterdam' }
    };
    Object.assign(this.translations.en, {
      thoughtProcess: 'Thought process'
    });
    Object.assign(this.translations.nl, {
      thoughtProcess: 'Denkproces',
    });
    Object.assign(this.translations.zh, {
      thoughtProcess: '思考过程'
    });
    Object.assign(this.translations.es, {
      thoughtProcess: 'Proceso de pensamiento'
    });
    this.pageTranslations = {
      nl: {
        common: { backPortfolio:'Terug naar portfolio', backWork:'Terug naar geselecteerd werk', viewWork:'Bekijk geselecteerd werk ↗', viewSource:'Bekijk broncode op GitHub', moreProjectsEyebrow:'Meer in ontwikkeling', moreProjectsTitle:'Meer projecten<br /><em>zijn onderweg.</em>', moreProjectsLink:'Bekijk wat hierna komt ↓', projectsHeading:'Projecten', projectSoon:'Binnenkort', projectSoonText:'Volgend project in ontwikkeling' },
        web: { webEyebrow:'01 / Huidige focus', webTitle:'Web<em>ontwikkeling.</em>', webSummary:'Ik bouw websites met oog voor detail. AI is mijn hulpmiddel, niet mijn bouwer, en beveiliging en SEO zitten er vanaf het begin in.', webLabel:'webproject', webHeading:'Zo bouw ik.', webParagraphOne:'Ik let op details. Ik gebruik AI als hulpmiddel voor ideeen, debuggen en snelheid, maar nooit als vervanging voor begrip. Elke layout, interactie en regel code controleer en vorm ik zelf.', webParagraphTwo:'Achter het ontwerp bouw ik sterke beveiliging en degelijke SEO: veilige werkwijzen, semantische HTML, nette metadata en goede prestaties. Zo is een site betrouwbaar, goed vindbaar en levendiger dan een site die puur vibe-gecodeerd is.', webProjectOne:'Responsieve zonne-energiewebsite' },
        design: { designEyebrow:'02 / Toekomstige focus', designTitle:'UI / UX<em>ontwerp.</em>', designSummary:'Ik gebruik ontwerp om een ruw idee om te zetten in een duidelijk pad dat natuurlijk, nuttig en menselijk aanvoelt.', designLabel:'interfacestudie', designHeading:'Waarom dit een toekomstige focus is.', designParagraphOne:'Goed ontwerp ligt op het snijpunt van visueel oordeel en empathie. Ik let graag op frictie, geef informatie vorm en maak een scherm makkelijker te begrijpen.', designParagraphTwo:'Nu groei ik door interfacestudies, visuele systemen en kleine projecten waarin elk detail zijn plaats moet verdienen.' },
        game: { gameEyebrow:'03 / Huidige focus', gameTitle:'Game<em>ontwikkeling.</em>', gameSummary:'Ik bouw games met oog voor detail. AI is mijn hulpmiddel, niet mijn bouwer, en ik houd controle over elk systeem dat ik uitbreng.', gameLabel:'gamewereld', gameHeading:'Zo bouw ik.', gameParagraphOne:'Ik let op details, van gamefeel tot feedback. Ik gebruik AI als hulpmiddel voor ideeen en debuggen, maar nooit als vervanging voor begrip. Elke mechanic en regel code controleer en vorm ik zelf.', gameParagraphTwo:'Games die ik op het web zet krijgen dezelfde zorg als mijn websites: sterke beveiliging, degelijke SEO en goede prestaties. Zo voelen ze levendig en betrouwbaar, niet puur vibe-gecodeerd.', gameProjectOne:'Incrementeel browserspel' },
        security: { securityEyebrow:'04 / Toekomstige focus', securityTitle:'Cyber<em>security.</em>', securitySummary:'Ik word aangetrokken door het maken van digitale ruimtes die betrouwbaar, veerkrachtig en veiliger in gebruik zijn.', securityLabel:'beveiligingssysteem', securityHeading:'Waarom dit een toekomstige focus is.', securityParagraphOne:'Beveiliging stelt een vraag die ik belangrijk vind: hoe kan technologie mensen beschermen zonder hun ervaring moeilijker te maken? Het combineert zorgvuldigheid, nieuwsgierigheid en verantwoordelijkheid.', securityParagraphTwo:'Ik bouw eerst mijn basis in webontwikkeling en wil daarna veilige systemen, ethisch testen en beslissingen verkennen die een product vanaf het begin veiliger maken.', securityParagraphThree:'Cybersecurity is een van de meest waardevolle vaardigheden in tech. Elke app, elk bedrijf en elke school draait op software, en nu AI, cloudservices en verbonden apparaten zich verspreiden, worden aanvallen vaker en geavanceerder. De vraag naar mensen die systemen kunnen verdedigen blijft groeien, en daarom richt ik mij hierop.' },
        cookies: { cookiesEyebrow:'01 / Webgame / 2026', cookiesTitle:'Cookies<em>Clicker.</em>', cookiesSummary:'Een incrementeel browserspel met een bevredigende lus: klik, verdien koekjes, laat de bakkerij groeien en speel meer vrij.', cookiesCaption:'Projectvoorbeeld / Cookies Clicker-game', cookiesHeading:'Een klein spel met een groeiend systeem.', cookiesParagraphOne:'Cookies Clicker verandert een eenvoudige actie in een voortgangsspel. Spelers verzamelen koekjes door te klikken en besteden ze vervolgens aan bakkerij-upgrades die na verloop van tijd momentum opbouwen.', cookiesParagraphTwo:'Ik maakte dit webspel met HTML, CSS en JavaScript, met een interface voor upgrades, boosts en live koekjesstatistieken. Het was een kans om gamefeedback, economiebalans en speelse interactie in de browser te verkennen.', moreProjectsEyebrow:'Meer in ontwikkeling', moreProjectsTitle:'Meer projecten<br /><em>zijn onderweg.</em>', moreProjectsLink:'Bekijk wat hierna komt ↓' },
        jontai: { jontaiEyebrow:'02 / Webontwikkeling / 2026', jontaiTitle:'Jontai<em>Energy.</em>', jontaiSummary:'Een heldere, responsieve website voor zonne-energie die bezoekers helpt duurzame oplossingen te ontdekken en contact op te nemen.', jontaiCaption:'Projectvoorbeeld / Jontai Energy-homepage', jontaiHeading:'Energie makkelijker te ontdekken.', jontaiParagraphOne:'Jontai Energy presenteert duurzame energie op een directe, toegankelijke manier. De pagina introduceert het bedrijf, leidt bezoekers door diensten en maakt een offerte aanvragen moeiteloos.', jontaiParagraphTwo:'Ik bouwde de site met HTML, CSS en JavaScript, met focus op responsieve layouts, duidelijke navigatie en een visuele taal die past bij een modern zonne-energiebedrijf.' }
      },
      zh: {
        common: { backPortfolio:'返回作品集', backWork:'返回精选作品', viewWork:'查看精选作品 ↗', viewSource:'在 GitHub 查看源代码', moreProjectsEyebrow:'更多项目进行中', moreProjectsTitle:'更多项目<br /><em>即将推出。</em>', moreProjectsLink:'查看下一个项目 ↓', projectsHeading:'项目', projectSoon:'即将推出', projectSoonText:'下一个项目进行中' },
        web: { webEyebrow:'01 / 当前重点', webTitle:'网页<em>开发。</em>', webSummary:'我注重细节地构建网站。AI 是我的助手，而不是建造者，安全和 SEO 从一开始就内置其中。', webLabel:'网页构建', webHeading:'我的构建方式。', webParagraphOne:'我注重细节。我把 AI 当作获取灵感、调试和提速的工具，而不是取代理解。每个布局、交互和每行代码都由我亲自审查和打磨。', webParagraphTwo:'在设计背后，我构建强大的安全和扎实的 SEO：安全的做法、语义化 HTML、规范的元数据和良好的性能。这让网站更可信、更易被找到，也比纯粹“凭感觉写代码”的网站更有生命力。', webProjectOne:'响应式太阳能网站' },
        design: { designEyebrow:'02 / 未来重点', designTitle:'UI / UX<em>设计。</em>', designSummary:'我用设计把粗略的想法变成清晰的路径，让它自然、实用且有人情味。', designLabel:'界面研究', designHeading:'为什么这是未来重点。', designParagraphOne:'好的设计处在视觉判断与共情的交汇点。我喜欢发现阻碍、组织信息，让屏幕更容易理解。', designParagraphTwo:'现在我通过界面研究、视觉系统和小型项目不断成长，每个细节都必须有存在的理由。' },
        game: { gameEyebrow:'03 / 当前重点', gameTitle:'游戏<em>开发。</em>', gameSummary:'我注重细节地构建游戏。AI 是我的助手，而不是建造者，我掌控发布的每个系统。', gameLabel:'游戏世界', gameHeading:'我的构建方式。', gameParagraphOne:'我注重细节，从游戏手感到反馈。我把 AI 当作灵感和调试的工具，而不是取代理解。每个机制和每行代码都由我亲自审查和打磨。', gameParagraphTwo:'我发布到网页上的游戏与我的网站一样用心：强大的安全、扎实的 SEO 和良好的性能。这让它们更有生命力、更可信，而不是纯粹“凭感觉写代码”。', gameProjectOne:'增量浏览器游戏' },
        security: { securityEyebrow:'04 / 未来重点', securityTitle:'网络<em>安全。</em>', securitySummary:'我被打造可靠、有韧性并让人们更安全使用的数字空间所吸引。', securityLabel:'安全系统', securityHeading:'为什么这是未来重点。', securityParagraphOne:'安全提出了我关心的问题：技术如何保护人们，同时不让体验变得更困难？它结合了细致思考、好奇心和责任感。', securityParagraphTwo:'我先在网页开发中打好基础，然后希望探索安全系统、道德测试，以及从一开始就让产品更安全的决策。', securityParagraphThree:'网络安全是科技领域最有价值的技能之一。每个应用、企业和学校都依赖软件，随着 AI、云服务和联网设备的普及，攻击变得更频繁、更复杂。对能够保护系统的人的需求只会继续增长，这正是我选择这个方向的原因。' },
        cookies: { cookiesEyebrow:'01 / 网页游戏 / 2026', cookiesTitle:'Cookies<em>Clicker。</em>', cookiesSummary:'一款围绕满足感循环打造的浏览器增量游戏：点击、赚取饼干、发展面包店，并解锁更多玩法。', cookiesCaption:'项目预览 / Cookies Clicker 游戏', cookiesHeading:'一个拥有成长系统的小型游戏。', cookiesParagraphOne:'Cookies Clicker 将简单动作变成进度游戏。玩家通过点击收集饼干，再花在面包店升级上，随着时间积累势头。', cookiesParagraphTwo:'我使用 HTML、CSS 和 JavaScript 制作这款网页游戏，包含升级、增益和实时饼干数据的界面。这让我探索了浏览器中的游戏反馈、经济平衡和趣味互动。', moreProjectsEyebrow:'更多项目进行中', moreProjectsTitle:'更多项目<br /><em>即将推出。</em>', moreProjectsLink:'查看下一个项目 ↓' },
        jontai: { jontaiEyebrow:'02 / 网页开发 / 2026', jontaiTitle:'Jontai<em>Energy。</em>', jontaiSummary:'一个清晰、响应式的太阳能网站，帮助访客发现可持续能源方案并取得联系。', jontaiCaption:'项目预览 / Jontai Energy 主页', jontaiHeading:'让能源更容易探索。', jontaiParagraphOne:'Jontai Energy 以直接、易懂的方式展示可持续能源。页面介绍公司，引导访客浏览服务，并让请求报价变得轻松。', jontaiParagraphTwo:'我使用 HTML、CSS 和 JavaScript 构建网站，重点是响应式布局、清晰导航和适合现代太阳能企业的视觉语言。' }
      },
      es: {
        common: { backPortfolio:'Volver al portafolio', backWork:'Volver al trabajo seleccionado', viewWork:'Ver trabajo seleccionado ↗', viewSource:'Ver codigo fuente en GitHub', moreProjectsEyebrow:'Mas proyectos en marcha', moreProjectsTitle:'Mas proyectos<br /><em>estan en camino.</em>', moreProjectsLink:'Mira lo que sigue ↓', projectsHeading:'Proyectos', projectSoon:'Proximamente', projectSoonText:'Siguiente proyecto en marcha' },
        web: { webEyebrow:'01 / Enfoque actual', webTitle:'Desarrollo<em>web.</em>', webSummary:'Construyo sitios web cuidando los detalles. La IA es mi ayuda, no mi constructora, y la seguridad y el SEO estan integrados desde el inicio.', webLabel:'proyecto web', webHeading:'Como construyo.', webParagraphOne:'Cuido los detalles. Uso la IA como herramienta para ideas, depuracion y velocidad, pero nunca como sustituto de entender. Reviso y doy forma yo mismo a cada diseno, interaccion y linea de codigo.', webParagraphTwo:'Detras del diseno construyo seguridad solida y buen SEO: practicas seguras, HTML semantico, metadatos limpios y buen rendimiento. Asi un sitio es confiable, facil de encontrar y mas vivo que uno hecho solo con vibe coding.', webProjectOne:'Sitio web solar adaptable' },
        design: { designEyebrow:'02 / Enfoque futuro', designTitle:'Diseno<em>UI / UX.</em>', designSummary:'Uso el diseno para convertir una idea inicial en un camino claro, natural, util y humano.', designLabel:'estudio de interfaz', designHeading:'Por que es un enfoque futuro.', designParagraphOne:'Un buen diseno se encuentra entre el juicio visual y la empatia. Disfruto detectar fricciones, organizar informacion y hacer una pantalla mas facil de entender.', designParagraphTwo:'Ahora crezco mediante estudios de interfaz, sistemas visuales y pequenos proyectos donde cada detalle debe ganarse su lugar.' },
        game: { gameEyebrow:'03 / Enfoque actual', gameTitle:'Desarrollo de<em>juegos.</em>', gameSummary:'Construyo juegos cuidando los detalles. La IA es mi ayuda, no mi constructora, y controlo cada sistema que publico.', gameLabel:'mundo de juego', gameHeading:'Como construyo.', gameParagraphOne:'Cuido los detalles, desde la sensacion de juego hasta la respuesta. Uso la IA como herramienta para ideas y depuracion, pero nunca como sustituto de entender. Reviso y doy forma yo mismo a cada mecanica y linea de codigo.', gameParagraphTwo:'Los juegos que publico en la web reciben el mismo cuidado que mis sitios: seguridad solida, buen SEO y buen rendimiento. Asi se sienten vivos y confiables, no hechos solo con vibe coding.', gameProjectOne:'Juego incremental de navegador' },
        security: { securityEyebrow:'04 / Enfoque futuro', securityTitle:'Ciber<em>seguridad.</em>', securitySummary:'Me atrae crear espacios digitales confiables, resistentes y mas seguros para las personas.', securityLabel:'sistema de seguridad', securityHeading:'Por que es un enfoque futuro.', securityParagraphOne:'La seguridad plantea una pregunta que me importa: como puede la tecnologia proteger a las personas sin dificultar su experiencia? Combina pensamiento cuidadoso, curiosidad y responsabilidad.', securityParagraphTwo:'Primero construyo mi base en desarrollo web; despues quiero explorar sistemas seguros, pruebas eticas y decisiones que hacen un producto mas seguro desde el inicio.', securityParagraphThree:'La ciberseguridad es una de las habilidades mas valiosas de la tecnologia. Cada aplicacion, empresa y escuela depende del software, y a medida que se extienden la IA, los servicios en la nube y los dispositivos conectados, los ataques son mas frecuentes y avanzados. La demanda de personas que sepan defender sistemas seguira creciendo, y por eso apunto a esto.' },
        cookies: { cookiesEyebrow:'01 / Juego web / 2026', cookiesTitle:'Cookies<em>Clicker.</em>', cookiesSummary:'Un juego incremental de navegador basado en un ciclo satisfactorio: haz clic, gana galletas, haz crecer la panaderia y desbloquea mas formas de jugar.', cookiesCaption:'Vista previa del proyecto / juego Cookies Clicker', cookiesHeading:'Un pequeno juego con un sistema creciente.', cookiesParagraphOne:'Cookies Clicker convierte una accion simple en un juego de progresion. Los jugadores consiguen galletas haciendo clic y las gastan en mejoras de panaderia que acumulan impulso con el tiempo.', cookiesParagraphTwo:'Lo hice como juego web con HTML, CSS y JavaScript, con una interfaz para mejoras, potenciadores y estadisticas en vivo. Fue una oportunidad para explorar respuesta de juego, equilibrio economico e interaccion ludica en el navegador.', moreProjectsEyebrow:'Mas proyectos en marcha', moreProjectsTitle:'Mas proyectos<br /><em>estan en camino.</em>', moreProjectsLink:'Mira lo que sigue ↓' },
        jontai: { jontaiEyebrow:'02 / Desarrollo web / 2026', jontaiTitle:'Jontai<em>Energy.</em>', jontaiSummary:'Un sitio web solar claro y adaptable que ayuda a los visitantes a descubrir soluciones sostenibles y ponerse en contacto.', jontaiCaption:'Vista previa del proyecto / pagina principal de Jontai Energy', jontaiHeading:'Energia mas facil de explorar.', jontaiParagraphOne:'Jontai Energy presenta la energia sostenible de forma directa y accesible. La pagina presenta la empresa, guia a los visitantes por sus servicios y facilita solicitar un presupuesto.', jontaiParagraphTwo:'Construi el sitio con HTML, CSS y JavaScript, centrandome en disenos adaptables, navegacion clara y un lenguaje visual apropiado para una empresa solar moderna.' }
      }
    };
    this.select.addEventListener('change', () => this.apply(this.select.value));
    this.apply(this.settings.get(this.storageKey, 'nl'));
  }

  apply(language) {
    const baseDictionary = this.translations[language] || this.translations.en;
    const pageDictionary = this.pageTranslations[language]?.[this.documentRoot.body.dataset.pageId] || {};
    const commonDictionary = this.pageTranslations[language]?.common || {};
    const dictionary = { ...baseDictionary, ...commonDictionary, ...pageDictionary };
    this.documentRoot.documentElement.lang = language;
    this.select.value = language;
    this.documentRoot.querySelectorAll('[data-i18n]').forEach((element) => {
      const translation = dictionary[element.dataset.i18n];
      if (translation !== undefined) element.innerHTML = translation;
    });
    this.settings.set(this.storageKey, language);
  }
}

class CursorEffect {
  constructor(documentRoot, windowRef) {
    this.documentRoot = documentRoot;
    this.window = windowRef;
    this.points = [];
    this.frame = null;
    this.lifetime = 480;
    this.maxWidth = 16;
    if (!this.window.matchMedia('(pointer: fine)').matches || this.window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.createCanvas();
    this.bindEvents();
  }

  bindEvents() {
    this.window.addEventListener('pointerdown', (event) => this.createPulse(event));
    this.window.addEventListener('pointermove', (event) => this.addPoint(event));
    this.window.addEventListener('resize', () => this.resizeCanvas());
  }

  createPulse(event) {
    const pulse = document.createElement('span');
    pulse.className = 'cursor-pulse';
    pulse.style.left = `${event.clientX}px`;
    pulse.style.top = `${event.clientY}px`;
    this.documentRoot.body.append(pulse);
    pulse.addEventListener('animationend', () => pulse.remove());
  }

  createCanvas() {
    this.canvas = this.documentRoot.createElement('canvas');
    this.canvas.className = 'cursor-trail';
    this.context = this.canvas.getContext('2d');
    this.documentRoot.body.append(this.canvas);
    this.resizeCanvas();
  }

  resizeCanvas() {
    const ratio = this.window.devicePixelRatio || 1;
    this.canvas.width = this.window.innerWidth * ratio;
    this.canvas.height = this.window.innerHeight * ratio;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  addPoint(event) {
    const last = this.points[this.points.length - 1];
    if (last && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 3) return;

    this.points.push({ x: event.clientX, y: event.clientY, time: this.window.performance.now() });
    if (this.frame === null) this.frame = this.window.requestAnimationFrame(() => this.draw());
  }

  draw() {
    const now = this.window.performance.now();
    this.points = this.points.filter((point) => now - point.time < this.lifetime);
    this.context.clearRect(0, 0, this.window.innerWidth, this.window.innerHeight);

    if (this.points.length < 2) {
      this.frame = null;
      return;
    }

    const halfWidths = this.points.map((point) => (this.maxWidth / 2) * Math.pow(1 - (now - point.time) / this.lifetime, 1.6));
    const left = [];
    const right = [];
    this.points.forEach((point, index) => {
      const before = this.points[Math.max(index - 1, 0)];
      const after = this.points[Math.min(index + 1, this.points.length - 1)];
      const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
      const normalX = -(after.y - before.y) / length;
      const normalY = (after.x - before.x) / length;
      left.push({ x: point.x + normalX * halfWidths[index], y: point.y + normalY * halfWidths[index] });
      right.push({ x: point.x - normalX * halfWidths[index], y: point.y - normalY * halfWidths[index] });
    });

    const tail = this.points[0];
    const head = this.points[this.points.length - 1];
    const color = this.documentRoot.body.classList.contains('dark') ? '199, 166, 237' : '141, 104, 189';
    const gradient = this.context.createLinearGradient(tail.x, tail.y, head.x, head.y);
    gradient.addColorStop(0, `rgba(${color}, 0)`);
    gradient.addColorStop(0.55, `rgba(${color}, 0.3)`);
    gradient.addColorStop(1, `rgba(${color}, 0.85)`);

    this.context.fillStyle = gradient;
    this.context.shadowColor = `rgba(${color}, 0.45)`;
    this.context.shadowBlur = 14;
    this.context.beginPath();
    this.context.moveTo(left[0].x, left[0].y);
    this.traceSmooth(left);
    this.context.lineTo(right[right.length - 1].x, right[right.length - 1].y);
    this.traceSmooth(right.slice().reverse());
    this.context.closePath();
    this.context.fill();

    this.context.beginPath();
    this.context.arc(head.x, head.y, halfWidths[halfWidths.length - 1], 0, Math.PI * 2);
    this.context.fill();

    this.frame = this.window.requestAnimationFrame(() => this.draw());
  }

  traceSmooth(points) {
    for (let index = 1; index < points.length - 1; index += 1) {
      const midX = (points[index].x + points[index + 1].x) / 2;
      const midY = (points[index].y + points[index + 1].y) / 2;
      this.context.quadraticCurveTo(points[index].x, points[index].y, midX, midY);
    }
    const last = points[points.length - 1];
    this.context.lineTo(last.x, last.y);
  }
}

class LoadingScreenController {
  constructor(documentRoot, windowRef) {
    this.element = documentRoot.querySelector('.loading-screen');
    this.window = windowRef;
    if (this.element) this.initialize();
  }

  initialize() {
    this.window.requestAnimationFrame(() => {
      this.element.classList.add('is-ready');
      this.window.setTimeout(() => this.dismiss(), 1000);
    });
  }

  dismiss() {
    this.element.classList.add('is-leaving');
    this.element.addEventListener('transitionend', () => this.element.remove(), { once: true });
    this.window.setTimeout(() => this.element.remove(), 750);
  }
}

class CareerWheelController {
  constructor(element, windowRef) {
    this.element = element;
    this.window = windowRef;
    this.ring = element.querySelector('.career-wheel__ring');
    this.cards = Array.from(element.querySelectorAll('.career-card'));
    this.focusOrder = [3, 0, 1, 2];
    this.focusIndex = 0;
    this.transitionDuration = 620;
    this.scrollThreshold = 70;
    this.swipeThreshold = 48;
    this.scrollProgress = 0;
    this.touchStartX = null;
    this.touchStartY = null;
    this.isHorizontalSwipe = false;
    this.isTransitioning = false;
    this.resetScrollTimer = null;
    this.setFocusedCard();
    this.element.addEventListener('wheel', (event) => this.handleWheel(event), { passive:false });
    this.element.addEventListener('touchstart', (event) => this.handleTouchStart(event), { passive: true });
    this.element.addEventListener('touchmove', (event) => this.handleTouchMove(event), { passive: false });
    this.element.addEventListener('touchend', (event) => this.handleTouchEnd(event), { passive: true });
  }

  isStacked() {
    return this.window.matchMedia('(max-width: 680px)').matches;
  }

  handleWheel(event) {
    if (this.isStacked()) return;
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    if (this.isTransitioning) {
      event.preventDefault();
      return;
    }

    this.scrollProgress += event.deltaY;
    this.window.clearTimeout(this.resetScrollTimer);
    this.resetScrollTimer = this.window.setTimeout(() => this.resetScrollProgress(), 180);

    if (Math.abs(this.scrollProgress) < this.scrollThreshold) return;

    event.preventDefault();
    this.rotate(this.scrollProgress > 0 ? 1 : -1);
    this.resetScrollProgress();
  }

  handleTouchStart(event) {
    if (this.isStacked()) return;
    const [touch] = event.touches;
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.isHorizontalSwipe = false;
  }

  handleTouchMove(event) {
    if (this.touchStartX === null) return;

    const [touch] = event.touches;
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY)) {
      this.isHorizontalSwipe = true;
      event.preventDefault();
    }
  }

  handleTouchEnd(event) {
    if (this.touchStartX === null || this.isTransitioning) return;

    const [touch] = event.changedTouches;
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    this.touchStartX = null;
    this.touchStartY = null;

    if (!this.isHorizontalSwipe || Math.abs(deltaX) < this.swipeThreshold || Math.abs(deltaX) < Math.abs(deltaY)) return;
    this.rotate(deltaX < 0 ? 1 : -1);
  }

  rotate(direction) {
    this.isTransitioning = true;
    this.focusIndex = (this.focusIndex + direction + this.focusOrder.length) % this.focusOrder.length;
    this.setFocusedCard();
    this.window.setTimeout(() => {
      this.isTransitioning = false;
    }, this.transitionDuration);
  }

  resetScrollProgress() {
    this.scrollProgress = 0;
    this.resetScrollTimer = null;
  }

  setFocusedCard() {
    const activeIndex = this.focusOrder[this.focusIndex];
    const aboveIndex = this.focusOrder[(this.focusIndex - 1 + this.focusOrder.length) % this.focusOrder.length];
    const belowIndex = this.focusOrder[(this.focusIndex + 1) % this.focusOrder.length];

    this.cards.forEach((card, index) => {
      card.classList.toggle('is-active', index === activeIndex);
      card.classList.toggle('is-above', index === aboveIndex);
      card.classList.toggle('is-below', index === belowIndex);
    });
  }
}

class PageController {
  constructor(documentRoot, windowRef) {
    this.documentRoot = documentRoot;
    this.window = windowRef;
  }

  initialize() {}
}

class HomePageController extends PageController {
  initialize() {
    const careerWheel = this.documentRoot.querySelector('.career-wheel');
    if (careerWheel) this.careerWheel = new CareerWheelController(careerWheel, this.window);
  }
}

class DetailPageController extends PageController {
  initialize() {
    this.detail = this.documentRoot.querySelector('.career-detail');
  }
}

class CareerPageController extends DetailPageController {}

class ProjectPageController extends DetailPageController {}

class PortfolioApp {
  constructor(documentRoot, windowRef) {
    this.documentRoot = documentRoot;
    this.window = windowRef;
    this.settings = new SettingsStore(this.window.localStorage);
    this.initialize();
  }

  initialize() {
    this.loader = new LoadingScreenController(this.documentRoot, this.window);
    this.theme = new ThemeController(this.find('.theme-toggle'), this.documentRoot, this.settings);
    this.language = new LanguageController(this.find('.language-select'), this.documentRoot, this.settings);
    this.cursor = new CursorEffect(this.documentRoot, this.window);
    this.page = this.createPageController();
    this.page.initialize();
    this.find('#year').textContent = new Date().getFullYear();
  }

  createPageController() {
    const pageType = this.documentRoot.body.dataset.page || 'home';
    const controllers = {
      home: HomePageController,
      career: CareerPageController,
      project: ProjectPageController
    };
    const Controller = controllers[pageType] || PageController;
    return new Controller(this.documentRoot, this.window);
  }

  find(selector) {
    const element = this.documentRoot.querySelector(selector);
    if (!element) throw new Error(`PortfolioApp could not find ${selector}.`);
    return element;
  }
}

document.addEventListener('DOMContentLoaded', () => new PortfolioApp(document, window));
