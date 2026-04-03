/**
 * Customization modal - UI for selecting ball colors and hats
 */

import { getAllColors, hexToString } from './ColorPalette.js';
import type * as THREE from 'three';

export interface CustomizationResult {
  color: number;
  hat: string;
}

export interface CustomizationOptions {
  onConfirm?: (result: CustomizationResult) => void;
  onCancel?: () => void;
  initialColor?: number;
  initialHat?: string;
}

const HAT_OPTIONS = ['none', 'santa', 'cowboy', 'crown', 'wizard'];

/**
 * Create and display a customization modal
 */
export function createCustomizationModal(
  playerName: string,
  options: CustomizationOptions = {}
): {
  modal: HTMLElement;
  close: () => void;
} {
  const { onConfirm, onCancel, initialColor = 0xff0000, initialHat = 'none' } = options;

  const colors = getAllColors();
  const modal = document.createElement('div');
  modal.id = 'customization-modal';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
    background: linear-gradient(135deg, rgba(10, 10, 50, 0.98), rgba(20, 10, 60, 0.98));
    padding: 40px;
    border-radius: 20px;
    color: white;
    border: 3px solid #00ffff;
    min-width: 600px;
    text-align: center;
    font-family: Arial, sans-serif;
    box-shadow: 0 0 60px rgba(0, 255, 255, 0.4), inset 0 0 20px rgba(0, 255, 255, 0.1);
    max-height: 90vh;
    overflow-y: auto;
  `;

  let selectedColor = initialColor;
  let selectedHat = initialHat;

  // Build color swatches grid
  let colorSwatchesHTML = '<div id="color-swatches" style="display: grid; grid-template-columns: repeat(6, 70px); gap: 12px; margin: 20px auto; justify-content: center;">';
  colors.forEach((color) => {
    const isSelected = color.hex === selectedColor ? 'border: 4px solid #ffff00; transform: scale(1.1);' : 'border: 2px solid rgba(255, 255, 255, 0.3);';
    colorSwatchesHTML += `
      <div class="color-swatch" data-color="${color.hex}" 
        style="
          width: 70px;
          height: 70px;
          background: ${hexToString(color.hex)};
          ${isSelected}
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          text-shadow: 0 0 3px black;
          opacity: 0.9;
        "
        title="${color.name}"
      >
        <span style="display: none;">${color.name}</span>
      </div>
    `;
  });
  colorSwatchesHTML += '</div>';

  // Build hat options
  let hatHTML = '<div id="hat-options" style="display: flex; gap: 15px; margin: 20px auto; justify-content: center; flex-wrap: wrap;">';
  HAT_OPTIONS.forEach((hat) => {
    const isSelected = hat === selectedHat ? 'background: #00ff00; color: black;' : 'background: rgba(0, 255, 255, 0.3); color: white;';
    hatHTML += `
      <button class="hat-option" data-hat="${hat}" 
        style="
          padding: 12px 20px;
          ${isSelected}
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
          transition: all 0.3s;
          text-transform: capitalize;
          min-width: 80px;
        "
      >
        ${hat}
      </button>
    `;
  });
  hatHTML += '</div>';

  modal.innerHTML = `
    <h1 style="margin-top: 0; color: #00ffff; text-shadow: 0 0 15px rgba(0, 255, 255, 0.6); font-size: 32px;">
      Customize ${playerName}
    </h1>
    
    <div id="preview-section" style="margin: 20px 0; padding: 20px; background: rgba(0, 0, 0, 0.4); border-radius: 10px; border: 2px dashed rgba(0, 255, 255, 0.3);">
      <p style="margin: 0 0 10px 0; opacity: 0.7; font-size: 14px;">Preview</p>
      <div id="preview-container" style="width: 150px; height: 150px; margin: 0 auto; background: rgba(0, 20, 40, 0.6); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
        <span style="opacity: 0.5; font-size: 24px;">Ball preview</span>
      </div>
    </div>

    <h3 style="margin: 30px 0 15px 0; color: #ffff00;">
      Select Color
    </h3>
    ${colorSwatchesHTML}

    <h3 style="margin: 30px 0 15px 0; color: #ffff00;">
      Select Hat Style
    </h3>
    ${hatHTML}

    <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid rgba(0, 255, 255, 0.2); display: flex; gap: 15px; justify-content: center;">
      <button id="confirm-btn" style="
        padding: 14px 40px;
        background: linear-gradient(135deg, #00ff00, #00dd00);
        color: black;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s;
        box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
      ">
        Confirm
      </button>
      
      <button id="cancel-btn" style="
        padding: 14px 40px;
        background: rgba(255, 0, 0, 0.6);
        color: white;
        border: 2px solid rgba(255, 0, 0, 0.8);
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s;
      ">
        Cancel
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners for color selection
  const colorSwatches = modal.querySelectorAll('.color-swatch');
  colorSwatches.forEach((swatch) => {
    const colorStr = (swatch as HTMLElement).dataset.color || '0xff0000';
    (swatch as HTMLElement).addEventListener('click', () => {
      selectedColor = parseInt(colorStr, 10);

      // Update visual state
      colorSwatches.forEach((s) => {
        if ((s as HTMLElement).dataset.color === colorStr) {
          (s as HTMLElement).style.border = '4px solid #ffff00';
          (s as HTMLElement).style.transform = 'scale(1.1)';
        } else {
          (s as HTMLElement).style.border = '2px solid rgba(255, 255, 255, 0.3)';
          (s as HTMLElement).style.transform = 'scale(1)';
        }
      });

      updatePreview();
    });
  });

  // Event listeners for hat selection
  const hatOptions = modal.querySelectorAll('.hat-option');
  hatOptions.forEach((btn) => {
    const hat = (btn as HTMLElement).dataset.hat || 'none';
    (btn as HTMLButtonElement).addEventListener('click', () => {
      selectedHat = hat;

      // Update visual state
      hatOptions.forEach((b) => {
        const isThis = (b as HTMLElement).dataset.hat === hat;
        (b as HTMLButtonElement).style.background = isThis ? '#00ff00' : 'rgba(0, 255, 255, 0.3)';
        (b as HTMLButtonElement).style.color = isThis ? 'black' : 'white';
      });

      updatePreview();
    });
  });

  // Preview update
  function updatePreview() {
    const previewContainer = modal.querySelector('#preview-container') as HTMLElement;
    if (!previewContainer) return;

    // Show color swatch with hat indicator
    const r = (selectedColor >> 16) & 255;
    const g = (selectedColor >> 8) & 255;
    const b = selectedColor & 255;
    const rgbColor = `rgb(${r}, ${g}, ${b})`;

    previewContainer.style.background = `
      radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4), ${rgbColor}, rgba(0, 0, 0, 0.4))
    `;
    previewContainer.style.border = `3px solid ${rgbColor}`;
    previewContainer.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 40px; color: white; text-shadow: 0 0 10px rgba(0,0,0,0.8); margin-bottom: 8px;">●</div>
        <div style="font-size: 12px; color: rgba(255, 255, 255, 0.8); text-transform: capitalize;">${selectedHat}</div>
      </div>
    `;
  }

  // Button events
  const confirmBtn = modal.querySelector('#confirm-btn') as HTMLButtonElement;
  const cancelBtn = modal.querySelector('#cancel-btn') as HTMLButtonElement;

  confirmBtn?.addEventListener('click', () => {
    if (onConfirm) {
      onConfirm({ color: selectedColor, hat: selectedHat });
    }
    close();
  });

  cancelBtn?.addEventListener('click', () => {
    if (onCancel) {
      onCancel();
    }
    close();
  });

  // Keyboard support
  modal.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      confirmBtn?.click();
    } else if (e.key === 'Escape') {
      cancelBtn?.click();
    }
  });

  // Close function
  function close() {
    modal.remove();
  }

  // Initial preview
  updatePreview();

  return {
    modal,
    close,
  };
}
