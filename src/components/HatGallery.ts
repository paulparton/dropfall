import * as THREE from 'three';
import { getAllColors, getDisplayColor } from './ColorPalette.js';
import { createBallMaterial } from '../utils/materialFactory.js';
import { animateHatMesh, createHatMesh, getHatFitTransform } from '../utils/hatFactory.js';
import { HAT_CATALOG, type HatDefinition } from '../utils/hatCatalog.js';

type BallColor = number | string;

interface HatGalleryOptions {
  initialColor: BallColor;
  onColorChange?: (color: number) => void;
  onClose?: () => void;
}

export interface HatGalleryController {
  element: HTMLElement;
  destroy: () => void;
}

class HatBallPreview {
  readonly canvas: HTMLCanvasElement;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly modelRoot = new THREE.Group();
  private readonly ball: THREE.Mesh<THREE.SphereGeometry, THREE.Material>;
  private readonly hatGroup: THREE.Group | null;
  private readonly resizeObserver: ResizeObserver;
  private observedHost: HTMLElement | null = null;
  private yaw = -0.35;
  private pitch = 0.02;
  private dragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  constructor(hat: Readonly<HatDefinition>, color: BallColor) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'hat-gallery-preview-canvas';
    this.canvas.setAttribute('aria-label', `${hat.label} on a rendered Dropfall ball`);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.camera.position.set(0, 1.05, 7.2);
    this.camera.lookAt(0, 0.85, 0);

    const hemisphere = new THREE.HemisphereLight(0xe9faff, 0x30164f, 2.7);
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xffffff, 4.2);
    key.position.set(3.5, 5, 4);
    this.scene.add(key);

    const cyanRim = new THREE.PointLight(0x2ceeff, 6.5, 12);
    cyanRim.position.set(-3, 2.2, 1);
    this.scene.add(cyanRim);

    const magentaRim = new THREE.PointLight(0xff38bd, 5.2, 12);
    magentaRim.position.set(3, 1.5, -2);
    this.scene.add(magentaRim);

    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 32),
      createBallMaterial(color),
    );
    this.modelRoot.add(this.ball);

    const hatResult = createHatMesh(hat.id, 1);
    this.hatGroup = hatResult?.group ?? null;
    if (this.hatGroup) {
      // This is the same attachment transform used by the live player.
      const fit = getHatFitTransform(this.hatGroup, 1);
      this.hatGroup.position.set(0, fit.attachmentHeight, 0);
      this.hatGroup.scale.setScalar(fit.scale);
      this.modelRoot.add(this.hatGroup);
    }
    this.scene.add(this.modelRoot);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(2.25, 2.7, 0.18, 48),
      new THREE.MeshStandardMaterial({
        color: 0x0b122a,
        metalness: 0.7,
        roughness: 0.28,
        emissive: 0x09152b,
        emissiveIntensity: 0.45,
      }),
    );
    platform.position.y = -1.22;
    this.scene.add(platform);

    const platformRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.3, 0.035, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x38f5ff }),
    );
    platformRing.rotation.x = Math.PI / 2;
    platformRing.position.y = -1.1;
    this.scene.add(platformRing);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.bindPointerControls();
  }

  attach(host: HTMLElement): void {
    if (this.observedHost) this.resizeObserver.unobserve(this.observedHost);
    this.observedHost = host;
    host.appendChild(this.canvas);
    this.resizeObserver.observe(host);
    this.resize();
  }

  updateColor(color: BallColor): void {
    const oldMaterial = this.ball.material;
    this.ball.material = createBallMaterial(color);
    oldMaterial.dispose();
  }

  render(timeSeconds: number, deltaSeconds: number, rotate: boolean): void {
    if (!this.observedHost || this.observedHost.offsetParent === null) return;

    if (rotate && !this.dragging) {
      this.yaw += deltaSeconds * 0.32;
    }
    this.modelRoot.rotation.set(this.pitch, this.yaw, 0);
    this.ball.rotation.x += deltaSeconds * 0.18;
    this.ball.rotation.z += deltaSeconds * 0.12;
    if (this.hatGroup) animateHatMesh(this.hatGroup, timeSeconds, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.canvas.remove();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) value.dispose();
        });
        material.dispose();
      });
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private resize(): void {
    if (!this.observedHost) return;
    const width = Math.max(1, this.observedHost.clientWidth);
    const height = Math.max(1, this.observedHost.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private bindPointerControls(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      this.dragging = true;
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.dragging) return;
      this.yaw += (event.clientX - this.lastPointerX) * 0.012;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + (event.clientY - this.lastPointerY) * 0.006,
        -0.28,
        0.28,
      );
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
    });
    const stopDragging = (event: PointerEvent) => {
      this.dragging = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    };
    this.canvas.addEventListener('pointerup', stopDragging);
    this.canvas.addEventListener('pointercancel', stopDragging);
  }
}

function colorCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function createHatGallery(options: HatGalleryOptions): HatGalleryController {
  const root = document.createElement('section');
  root.className = 'hat-gallery';
  root.setAttribute('aria-label', 'Hat Gallery');

  const header = document.createElement('header');
  header.className = 'hat-gallery-header';

  const heading = document.createElement('div');
  heading.className = 'hat-gallery-heading';
  heading.innerHTML = `
    <span class="hat-gallery-kicker">COSMETIC FIT LAB // LIVE RENDER</span>
    <h1>Hat Gallery</h1>
    <p>Every launch hat on the real player ball. Select one for a full-screen fit check.</p>
  `;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'hat-gallery-back';
  closeButton.textContent = 'Back to Play Plaza';
  header.append(heading, closeButton);

  const colorPanel = document.createElement('section');
  colorPanel.className = 'hat-gallery-colors';
  colorPanel.setAttribute('aria-label', 'Ball colour picker');

  const colorIntro = document.createElement('div');
  colorIntro.className = 'hat-gallery-colors__intro';
  colorIntro.innerHTML = `
    <span>PLAYER PAINT</span>
    <strong>Ball colour</strong>
    <small>Applied to every live preview</small>
  `;

  const swatchRail = document.createElement('div');
  swatchRail.className = 'hat-gallery-swatch-rail';

  const customColorLabel = document.createElement('label');
  customColorLabel.className = 'hat-gallery-custom-color';
  customColorLabel.innerHTML = '<span>Custom</span>';
  const customColor = document.createElement('input');
  customColor.type = 'color';
  customColor.setAttribute('aria-label', 'Custom ball colour');
  customColor.value = colorCss(getDisplayColor(options.initialColor));
  customColorLabel.appendChild(customColor);

  colorPanel.append(colorIntro, swatchRail, customColorLabel);

  const grid = document.createElement('div');
  grid.className = 'hat-gallery-grid';

  const inspector = document.createElement('div');
  inspector.className = 'hat-gallery-inspector hidden';
  inspector.setAttribute('role', 'dialog');
  inspector.setAttribute('aria-modal', 'true');
  inspector.setAttribute('aria-label', 'Full-screen hat preview');
  inspector.innerHTML = `
    <div class="hat-gallery-inspector__glow" aria-hidden="true"></div>
    <header class="hat-gallery-inspector__header">
      <div>
        <span>FULL-SCREEN FIT CHECK</span>
        <h2></h2>
      </div>
      <button type="button" class="hat-gallery-inspector__close" aria-label="Close full-screen preview">Close</button>
    </header>
    <div class="hat-gallery-inspector__stage"></div>
    <footer class="hat-gallery-inspector__footer">
      <button type="button" data-gallery-direction="-1" aria-label="Previous hat">‹ Previous</button>
      <p>Drag to rotate · inspect the brim, crown and attachment from every angle</p>
      <button type="button" data-gallery-direction="1" aria-label="Next hat">Next ›</button>
    </footer>
  `;

  root.append(header, colorPanel, grid, inspector);

  const previews: HatBallPreview[] = [];
  const cardHosts: HTMLElement[] = [];
  let selectedColor: BallColor = options.initialColor;
  let expandedIndex: number | null = null;
  let animationId = 0;
  let lastTime = performance.now();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const setExpanded = (nextIndex: number | null) => {
    if (expandedIndex !== null) {
      previews[expandedIndex]?.attach(cardHosts[expandedIndex]!);
    }

    expandedIndex = nextIndex;
    if (nextIndex === null) {
      inspector.classList.add('hidden');
      document.body.classList.remove('hat-gallery-expanded');
      return;
    }

    const hat = HAT_CATALOG[nextIndex];
    if (!hat) return;
    const stage = inspector.querySelector<HTMLElement>('.hat-gallery-inspector__stage');
    const title = inspector.querySelector<HTMLElement>('h2');
    if (!stage || !title) return;

    title.textContent = hat.label;
    inspector.classList.remove('hidden');
    document.body.classList.add('hat-gallery-expanded');
    previews[nextIndex]?.attach(stage);
    inspector.querySelector<HTMLButtonElement>('.hat-gallery-inspector__close')?.focus();
  };

  HAT_CATALOG.forEach((hat, index) => {
    const card = document.createElement('article');
    card.className = 'hat-gallery-card';
    card.dataset.hatId = hat.id;

    const previewButton = document.createElement('button');
    previewButton.type = 'button';
    previewButton.className = 'hat-gallery-card__preview';
    previewButton.setAttribute('aria-label', `Expand ${hat.label} preview`);

    const canvasHost = document.createElement('div');
    canvasHost.className = 'hat-gallery-card__canvas';
    previewButton.appendChild(canvasHost);

    const cardCopy = document.createElement('div');
    cardCopy.className = 'hat-gallery-card__copy';
    const ordinal = String(index + 1).padStart(2, '0');
    cardCopy.innerHTML = `
      <div><span>FIT CHECK ${ordinal}</span><h2>${hat.label}</h2></div>
      <span class="hat-gallery-card__expand">Expand <b aria-hidden="true">↗</b></span>
    `;

    previewButton.addEventListener('click', () => setExpanded(index));
    card.append(previewButton, cardCopy);
    grid.appendChild(card);

    const preview = new HatBallPreview(hat, selectedColor);
    previews.push(preview);
    cardHosts.push(canvasHost);
    preview.attach(canvasHost);
  });

  const swatches = getAllColors();
  const updateSwatchSelection = () => {
    swatchRail.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      const active = typeof selectedColor === 'number'
        && Number(button.dataset.color) === selectedColor;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };
  const setColor = (color: number) => {
    selectedColor = color;
    customColor.value = colorCss(color);
    previews.forEach((preview) => preview.updateColor(color));
    updateSwatchSelection();
    options.onColorChange?.(color);
  };

  swatches.forEach((color) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'hat-gallery-swatch';
    swatch.dataset.color = String(color.hex);
    swatch.title = color.name;
    swatch.setAttribute('aria-label', color.name);
    swatch.style.setProperty('--swatch-color', colorCss(color.hex));
    swatch.addEventListener('click', () => setColor(color.hex));
    swatchRail.appendChild(swatch);
  });
  updateSwatchSelection();

  customColor.addEventListener('input', () => {
    setColor(Number.parseInt(customColor.value.slice(1), 16));
  });

  inspector.querySelector<HTMLButtonElement>('.hat-gallery-inspector__close')
    ?.addEventListener('click', () => setExpanded(null));
  inspector.querySelectorAll<HTMLButtonElement>('[data-gallery-direction]').forEach((button) => {
    button.addEventListener('click', () => {
      const direction = Number(button.dataset.galleryDirection);
      const current = expandedIndex ?? 0;
      setExpanded((current + direction + HAT_CATALOG.length) % HAT_CATALOG.length);
    });
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (expandedIndex === null) return;
    if (event.key === 'Escape') setExpanded(null);
    if (event.key === 'ArrowLeft') {
      setExpanded((expandedIndex - 1 + HAT_CATALOG.length) % HAT_CATALOG.length);
    }
    if (event.key === 'ArrowRight') {
      setExpanded((expandedIndex + 1) % HAT_CATALOG.length);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  const animate = (time: number) => {
    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    const timeSeconds = time / 1000;
    previews.forEach((preview) => preview.render(timeSeconds, delta, !reduceMotion));
    animationId = requestAnimationFrame(animate);
  };
  animationId = requestAnimationFrame(animate);

  closeButton.addEventListener('click', () => options.onClose?.());

  const destroy = () => {
    cancelAnimationFrame(animationId);
    document.removeEventListener('keydown', onKeyDown);
    document.body.classList.remove('hat-gallery-expanded');
    previews.forEach((preview) => preview.dispose());
    root.remove();
  };

  return { element: root, destroy };
}
