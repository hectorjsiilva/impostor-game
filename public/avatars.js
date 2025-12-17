// Sistema de Avatares Animados
const AVATARS = {
  avatar1: {
    name: 'Astro',
    emoji: '🚀',
    color: '#FF6B9D',
    gradient: 'linear-gradient(135deg, #FF6B9D 0%, #C06C84 100%)'
  },
  avatar2: {
    name: 'Alien',
    emoji: '👽',
    color: '#4ECDC4',
    gradient: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)'
  },
  avatar3: {
    name: 'Robot',
    emoji: '🤖',
    color: '#A8E6CF',
    gradient: 'linear-gradient(135deg, #A8E6CF 0%, #7FB3D5 100%)'
  },
  avatar4: {
    name: 'Ninja',
    emoji: '🥷',
    color: '#FFD93D',
    gradient: 'linear-gradient(135deg, #FFD93D 0%, #FFA34D 100%)'
  },
  avatar5: {
    name: 'Pirata',
    emoji: '🏴‍☠️',
    color: '#9D84B7',
    gradient: 'linear-gradient(135deg, #9D84B7 0%, #6C5B7B 100%)'
  },
  avatar6: {
    name: 'Mago',
    emoji: '🧙',
    color: '#F67280',
    gradient: 'linear-gradient(135deg, #F67280 0%, #C06C84 100%)'
  },
  avatar7: {
    name: 'Unicornio',
    emoji: '🦄',
    color: '#C7CEEA',
    gradient: 'linear-gradient(135deg, #C7CEEA 0%, #B8A9C9 100%)'
  },
  avatar8: {
    name: 'Dragón',
    emoji: '🐉',
    color: '#FF6B6B',
    gradient: 'linear-gradient(135deg, #FF6B6B 0%, #EE5A6F 100%)'
  },
  avatar9: {
    name: 'Fantasma',
    emoji: '👻',
    color: '#95E1D3',
    gradient: 'linear-gradient(135deg, #95E1D3 0%, #38ADA9 100%)'
  },
  avatar10: {
    name: 'Panda',
    emoji: '🐼',
    color: '#F38181',
    gradient: 'linear-gradient(135deg, #F38181 0%, #FCE38A 100%)'
  }
};

// Función para crear elemento de avatar
function createAvatarElement(avatarId, size = 'medium', showBorder = true) {
  const avatar = AVATARS[avatarId] || AVATARS.avatar1;
  const sizes = {
    small: '40px',
    medium: '60px',
    large: '80px',
    xlarge: '120px'
  };
  
  // Si size es un número, usarlo directamente
  const finalSize = typeof size === 'number' ? `${size}px` : (sizes[size] || sizes.medium);
  
  const div = document.createElement('div');
  div.className = 'avatar-container';
  div.style.cssText = `
    width: ${finalSize};
    height: ${finalSize};
    border-radius: 50%;
    background: ${avatar.gradient};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(${finalSize} * 0.5);
    ${showBorder ? 'border: 3px solid rgba(255,255,255,0.3);' : ''}
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    position: relative;
    overflow: hidden;
  `;
  
  div.innerHTML = `
    <span class="avatar-emoji">${avatar.emoji}</span>
    <div class="avatar-shine"></div>
  `;
  
  // Efecto hover
  div.addEventListener('mouseenter', function() {
    this.style.transform = 'scale(1.1) translateY(-2px)';
    this.style.boxShadow = `0 8px 25px ${avatar.color}80`;
  });
  
  div.addEventListener('mouseleave', function() {
    this.style.transform = 'scale(1) translateY(0)';
    this.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
  });
  
  return div;
}

// Función para obtener info del avatar
function getAvatarInfo(avatarId) {
  return AVATARS[avatarId] || AVATARS.avatar1;
}

// Función para generar selector de avatares
function createAvatarSelector(onSelect) {
  const container = document.createElement('div');
  container.className = 'avatar-selector';
  container.style.cssText = `
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 15px;
    padding: 20px;
    background: rgba(255,255,255,0.05);
    border-radius: 15px;
    margin: 20px 0;
  `;
  
  Object.keys(AVATARS).forEach(avatarId => {
    const avatarEl = createAvatarElement(avatarId, 'medium', true);
    avatarEl.dataset.avatar = avatarId; // Agregar data-avatar
    avatarEl.classList.add('avatar-option'); // Agregar clase para selección
    
    avatarEl.onclick = () => {
      // Marcar como seleccionado
      container.querySelectorAll('.avatar-option').forEach(el => {
        el.style.border = '3px solid rgba(255,255,255,0.3)';
        el.classList.remove('selected');
      });
      avatarEl.style.border = '3px solid #00FF88';
      avatarEl.classList.add('selected');
      
      if (onSelect) onSelect(avatarId);
    };
    
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 8px;';
    wrapper.appendChild(avatarEl);
    
    const name = document.createElement('div');
    name.textContent = AVATARS[avatarId].name;
    name.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.8); font-weight: 600;';
    wrapper.appendChild(name);
    
    container.appendChild(wrapper);
  });
  
  // Seleccionar el primer avatar por defecto
  setTimeout(() => {
    const firstAvatar = container.querySelector('.avatar-option');
    if (firstAvatar) {
      firstAvatar.click();
    }
  }, 100);
  
  return container;
}
