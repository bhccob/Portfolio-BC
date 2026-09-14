class ThemeController {
  constructor(button) {
    this.button = button;
    this.storageKey = 'bob-portfolio-theme';
    this.initialize();
  }

  initialize() {
    const savedTheme = localStorage.getItem(this.storageKey);
    if (savedTheme === 'dark') document.body.classList.add('dark');
    this.button.addEventListener('click', () => this.toggle());
  }

  toggle() {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem(this.storageKey, isDark ? 'dark' : 'light');
  }
}

class LanguageController {
  constructor(select) {
    this.select = select;
    this.storageKey = 'bob-portfolio-language';
    this.translations = {
      en: { navWork:'Work', navAbout:'About', navContact:'Contact', available:'Available for selected collaborations', heroLine1:'Building bright', heroLine2:'digital worlds.', heroIntro:'A curious designer and developer from Aruba, now learning and building in Rotterdam.', scroll:'Scroll to explore', selectedWork:'Selected work', workTitle:'Things I make<br />with intent.', projectNote:'A home for future experiments, selected builds, and learning in public.', aboutLabel:'The person behind it', aboutTitle:'Learning the craft,<br /><em>one useful thing</em> at a time.', aboutText:'Chinese by blood. Raised in Aruba. Now studying in the Netherlands. I move between design, games, and security. Each one teaches me something the others don\'t. I build with curiosity and test with honesty. Home isn\'t one place for me. It\'s a mix of cultures and questions I keep chasing.', daily:'Daily', comfortable:'Comfortable', portrait:'Your portrait<br />goes here', offScreen:'Off screen', lifeTitle:'A good life<br />needs <em>momentum.</em>', contactLabel:'Let us make something', contactTitle:'Have an idea?<br /><em>Say hello.</em>', backTop:'Back to top ↑', footer:'Made with curiosity in Rotterdam' },
      nl: { navWork:'Werk', navAbout:'Over mij', navContact:'Contact', available:'Beschikbaar voor geselecteerde samenwerkingen', heroLine1:'Ik bouw heldere', heroLine2:'digitale werelden.', heroIntro:'Een nieuwsgierige ontwerper en ontwikkelaar uit Aruba, nu lerend en bouwend in Rotterdam.', scroll:'Ontdek meer', selectedWork:'Geselecteerd werk', workTitle:'Dingen die ik maak<br />met intentie.', projectNote:'Een plek voor toekomstige experimenten, projecten en leren in het openbaar.', aboutLabel:'De persoon erachter', aboutTitle:'Het vak leren,<br /><em>een bruikbaar ding</em> tegelijk.', aboutText:'Chinees van bloed, 18 jaar opgegroeid in Aruba en nu studerend in Nederland. Ik ben een eerlijke, gepassioneerde leerling tussen ontwerp, games en veiligheid.', daily:'Dagelijks', comfortable:'Vertrouwd met', portrait:'Jouw portret<br />komt hier', offScreen:'Buiten beeld', lifeTitle:'Een goed leven<br />vraagt <em>beweging.</em>', contactLabel:'Laten we iets maken', contactTitle:'Een idee?<br /><em>Zeg hallo.</em>', backTop:'Naar boven ↑', footer:'Met nieuwsgierigheid gemaakt in Rotterdam' },
      zh: { navWork:'作品', navAbout:'关于我', navContact:'联系', available:'接受精选合作', heroLine1:'构建明亮的', heroLine2:'数字世界。', heroIntro:'来自阿鲁巴的好奇设计师与开发者，现在在鹿特丹学习和创作。', scroll:'向下探索', selectedWork:'精选作品', workTitle:'带着想法<br />创作的作品。', projectNote:'未来实验、精选项目和公开学习的空间。', aboutLabel:'背后的我', aboutTitle:'学习技艺，<br /><em>一次做好一件事。</em>', aboutText:'血统是华人，在阿鲁巴成长了18年，现在在荷兰学习。我诚实、热情，正在设计、游戏与网络安全之间寻找方向。', daily:'日常使用', comfortable:'熟悉使用', portrait:'你的肖像<br />放在这里', offScreen:'屏幕之外', lifeTitle:'好生活<br />需要<em>动力。</em>', contactLabel:'一起创造些东西', contactTitle:'有个想法？<br /><em>来打个招呼。</em>', backTop:'回到顶部 ↑', footer:'在鹿特丹用好奇心制作' },
      es: { navWork:'Trabajo', navAbout:'Sobre mí', navContact:'Contacto', available:'Disponible para colaboraciones seleccionadas', heroLine1:'Construyendo brillantes', heroLine2:'mundos digitales.', heroIntro:'Un diseñador y desarrollador curioso de Aruba, aprendiendo y creando ahora en Róterdam.', scroll:'Explorar', selectedWork:'Trabajo seleccionado', workTitle:'Cosas que hago<br />con intención.', projectNote:'Un hogar para experimentos, proyectos seleccionados y aprender en público.', aboutLabel:'La persona detrás', aboutTitle:'Aprendiendo el oficio,<br /><em>una cosa útil</em> a la vez.', aboutText:'Chino de sangre, crecí 18 años en Aruba y ahora estudio en los Países Bajos. Soy un aprendiz honesto y apasionado entre diseño, juegos y seguridad.', daily:'Diario', comfortable:'Cómodo con', portrait:'Tu retrato<br />va aquí', offScreen:'Fuera de pantalla', lifeTitle:'Una buena vida<br />necesita <em>impulso.</em>', contactLabel:'Hagamos algo', contactTitle:'¿Una idea?<br /><em>Di hola.</em>', backTop:'Volver arriba ↑', footer:'Hecho con curiosidad en Róterdam' }
    };
    this.select.addEventListener('change', () => this.apply(this.select.value));
    this.apply(localStorage.getItem(this.storageKey) || 'en');
  }

  apply(language) {
    const dictionary = this.translations[language];
    document.documentElement.lang = language;
    this.select.value = language;
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      element.innerHTML = dictionary[element.dataset.i18n];
    });
    localStorage.setItem(this.storageKey, language);
  }
}

class CursorEffect {
  constructor() {
    if (!window.matchMedia('(pointer: fine)').matches) return;

    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('pointerdown', (event) => this.createPulse(event));
  }

  createPulse(event) {
    const pulse = document.createElement('span');
    pulse.className = 'cursor-pulse';
    pulse.style.left = `${event.clientX}px`;
    pulse.style.top = `${event.clientY}px`;
    document.body.append(pulse);
    pulse.addEventListener('animationend', () => pulse.remove());
  }
}

class PortfolioApp {
  constructor() {
    this.theme = new ThemeController(document.querySelector('.theme-toggle'));
    this.language = new LanguageController(document.querySelector('.language-select'));
    this.cursor = new CursorEffect();
    document.getElementById('year').textContent = new Date().getFullYear();
  }
}

document.addEventListener('DOMContentLoaded', () => new PortfolioApp());
