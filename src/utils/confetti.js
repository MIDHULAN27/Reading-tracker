/**
 * Custom High-Fidelity Canvas Confetti Engine
 * Renders physics-based floating particles on demand
 * with zero external dependencies.
 */

export function triggerConfetti() {
  if (typeof document === 'undefined') return;

  // Create canvas overlay
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  // Re-calculate on window resize
  const handleResize = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', handleResize);

  // Confetti Particle Class
  class Particle {
    constructor() {
      // Emitters located at the bottom-left and bottom-right corners
      this.side = Math.random() > 0.5 ? 'left' : 'right';
      this.x = this.side === 'left' ? 0 : width;
      this.y = height * 0.9; // start near bottom
      
      // Spray angles
      const angle = this.side === 'left' 
        ? -Math.PI / 4 - Math.random() * (Math.PI / 6) // spray up-right
        : -3 * Math.PI / 4 + Math.random() * (Math.PI / 6); // spray up-left
      
      const speed = 14 + Math.random() * 12;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      
      this.gravity = 0.45;
      this.drag = 0.98;
      
      // Sizes & Colors
      this.size = 6 + Math.random() * 8;
      const colors = [
        '#F59E0B', // amber
        '#D97706', // amber-dark
        '#8B5CF6', // lavender
        '#A78BFA', // lavender-light
        '#10B981', // emerald
        '#3B82F6', // blue
        '#EF4444'  // red
      ];
      this.color = colors[Math.floor(Math.random() * colors.length)];
      
      this.rotation = Math.random() * 360;
      this.rotationSpeed = -4 + Math.random() * 8;
      this.opacity = 1;
    }

    update() {
      this.vx *= this.drag;
      this.vy += this.gravity;
      this.vy *= this.drag;
      
      this.x += this.vx;
      this.y += this.vy;
      
      this.rotation += this.rotationSpeed;
      
      // Fade out as it falls off the screen
      if (this.y > height * 0.7) {
        this.opacity -= 0.015;
      }
    }

    draw() {
      if (this.opacity <= 0) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate((this.rotation * Math.PI) / 180);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.opacity;
      
      // Draw rectangular confetti slice
      ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
      ctx.restore();
    }
  }

  // Populate particles
  const particles = Array.from({ length: 140 }, () => new Particle());

  // Animation Loop
  function tick() {
    ctx.clearRect(0, 0, width, height);

    let active = false;
    particles.forEach(p => {
      p.update();
      p.draw();
      if (p.opacity > 0 && p.y < height && p.x >= -50 && p.x <= width + 50) {
        active = true;
      }
    });

    if (active) {
      requestAnimationFrame(tick);
    } else {
      // Cleanup DOM node once done
      window.removeEventListener('resize', handleResize);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
  }

  tick();
}
