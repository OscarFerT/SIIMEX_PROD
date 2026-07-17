import { Component, AfterViewInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-cambiar-contrasena',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './cambiar-contrasena.component.html',
  styleUrl: './cambiar-contrasena.component.css'
})
export class CambiarContrasenaComponent implements AfterViewInit {
  private http = inject(HttpClient);
  private router = inject(Router);

  // Signals para visibilidad de contraseñas
  pwVisible = signal(false);
  pw2Visible = signal(false);

  // Signals para validación
  passwordStrength = signal<0 | 1 | 2 | 3 | 4>(0);
  passwordsMatch = signal(false);
  identifiersCount = signal(0);
  submitting = signal(false);

  // Validadores
  private readonly CURP_REGEX = /^[A-ZX]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
  private readonly RFC_REGEX = /^[A-ZÑ&X]{3,4}\d{6}[A-Z0-9]{2,3}$/;

  ngAfterViewInit(): void {
    this.setupPasswordValidation();
    this.setupIdentifierValidation();
    this.setupPasswordToggle();
    this.setupFormValidation();
  }

  // ============================================
  // TOGGLE DE VISIBILIDAD DE CONTRASEÑAS
  // ============================================
  setupPasswordToggle(): void {
    const pwToggle = document.getElementById('pwToggle');
    const pw2Toggle = document.getElementById('pw2Toggle');
    const pwInput = document.getElementById('pw') as HTMLInputElement;
    const pw2Input = document.getElementById('pw2') as HTMLInputElement;
    const pwToggleIcon = document.getElementById('pwToggleIcon');
    const pw2ToggleIcon = document.getElementById('pw2ToggleIcon');

    if (pwToggle && pwInput && pwToggleIcon) {
      pwToggle.addEventListener('click', () => {
        this.pwVisible.set(!this.pwVisible());
        pwInput.type = this.pwVisible() ? 'text' : 'password';
        pwToggleIcon.classList.toggle('fa-eye', !this.pwVisible());
        pwToggleIcon.classList.toggle('fa-eye-slash', this.pwVisible());
      });
    }

    if (pw2Toggle && pw2Input && pw2ToggleIcon) {
      pw2Toggle.addEventListener('click', () => {
        this.pw2Visible.set(!this.pw2Visible());
        pw2Input.type = this.pw2Visible() ? 'text' : 'password';
        pw2ToggleIcon.classList.toggle('fa-eye', !this.pw2Visible());
        pw2ToggleIcon.classList.toggle('fa-eye-slash', this.pw2Visible());
      });
    }
  }

  // ============================================
  // VALIDACIÓN DE CONTRASEÑA
  // ============================================
  setupPasswordValidation(): void {
    const pwInput = document.getElementById('pw') as HTMLInputElement;
    const pw2Input = document.getElementById('pw2') as HTMLInputElement;
    const pwBar = document.getElementById('pwBar');
    const pwValidation = document.getElementById('pwValidation');
    const pw2Validation = document.getElementById('pw2Validation');

    if (pwInput) {
      pwInput.addEventListener('input', () => {
        const password = pwInput.value;
        this.updatePasswordStrength(password);
        this.updatePasswordRequirements(password);
        this.updatePasswordMeter(password);
        this.validatePasswordMatch();
        this.updatePasswordValidationIcon(pwInput, pwValidation, password);
      });
    }

    if (pw2Input) {
      pw2Input.addEventListener('input', () => {
        this.validatePasswordMatch();
        this.updatePassword2ValidationIcon(pw2Input, pw2Validation);
      });
    }
  }

  updatePasswordStrength(password: string): void {
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    // Asegurar que strength esté en el rango 0-4
    const clampedStrength = Math.min(4, Math.max(0, strength)) as 0 | 1 | 2 | 3 | 4;
    this.passwordStrength.set(clampedStrength);
  }

  updatePasswordMeter(password: string): void {
    const pwBar = document.getElementById('pwBar');
    if (!pwBar) return;

    const strength = this.passwordStrength();
    
    // Remover todas las clases y resetear width
    pwBar.classList.remove('w1', 'w2', 'w3', 'w4');
    pwBar.style.width = '0%';
    
    if (password.length === 0) {
      return;
    }

    // Forzar reflow para que la animación funcione
    void pwBar.offsetWidth;

    switch (strength) {
      case 1:
        pwBar.classList.add('w1');
        // Asegurar que el width se establezca
        setTimeout(() => {
          pwBar.style.width = '25%';
        }, 10);
        break;
      case 2:
        pwBar.classList.add('w2');
        setTimeout(() => {
          pwBar.style.width = '50%';
        }, 10);
        break;
      case 3:
        pwBar.classList.add('w3');
        setTimeout(() => {
          pwBar.style.width = '75%';
        }, 10);
        break;
      case 4:
        pwBar.classList.add('w4');
        setTimeout(() => {
          pwBar.style.width = '100%';
        }, 10);
        break;
      default:
        pwBar.style.width = '0%';
    }
  }

  updatePasswordRequirements(password: string): void {
    const requirements = {
      rLen: password.length >= 8,
      rUpper: /[A-Z]/.test(password),
      rLower: /[a-z]/.test(password),
      rNum: /\d/.test(password),
      rSym: /[^A-Za-z0-9]/.test(password)
    };

    Object.keys(requirements).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        if (requirements[key as keyof typeof requirements]) {
          element.classList.add('ok');
        } else {
          element.classList.remove('ok');
        }
      }
    });
  }

  validatePasswordMatch(): void {
    const pwInput = document.getElementById('pw') as HTMLInputElement;
    const pw2Input = document.getElementById('pw2') as HTMLInputElement;
    
    if (!pwInput || !pw2Input) return;

    const match = pwInput.value === pw2Input.value && pwInput.value.length > 0;
    this.passwordsMatch.set(match);

    if (pw2Input.value.length > 0) {
      if (match) {
        pw2Input.classList.remove('is-invalid');
        pw2Input.classList.add('is-valid');
        const validFeedback = pw2Input.parentElement?.querySelector('.valid-feedback');
        if (validFeedback) {
          validFeedback.classList.remove('d-none');
        }
        const invalidFeedback = pw2Input.parentElement?.querySelector('.invalid-feedback') as HTMLElement;
        if (invalidFeedback) {
          invalidFeedback.style.display = 'none';
        }
      } else {
        pw2Input.classList.remove('is-valid');
        pw2Input.classList.add('is-invalid');
        const validFeedback = pw2Input.parentElement?.querySelector('.valid-feedback');
        if (validFeedback) {
          validFeedback.classList.add('d-none');
        }
        const invalidFeedback = pw2Input.parentElement?.querySelector('.invalid-feedback') as HTMLElement;
        if (invalidFeedback) {
          invalidFeedback.style.display = 'block';
        }
      }
    } else {
      pw2Input.classList.remove('is-valid', 'is-invalid');
    }
  }

  updatePasswordValidationIcon(input: HTMLInputElement, iconElement: HTMLElement | null, password: string): void {
    if (!iconElement) return;

    const isValid = password.length >= 8 && 
                    /[A-Z]/.test(password) && 
                    /[a-z]/.test(password) && 
                    /\d/.test(password);

    iconElement.innerHTML = isValid 
      ? '<i class="fas fa-check-circle text-success"></i>'
      : '<i class="fas fa-times-circle text-danger"></i>';

    if (password.length > 0) {
      input.classList.toggle('is-valid', isValid);
      input.classList.toggle('is-invalid', !isValid);
    } else {
      input.classList.remove('is-valid', 'is-invalid');
      iconElement.innerHTML = '';
    }
  }

  updatePassword2ValidationIcon(input: HTMLInputElement, iconElement: HTMLElement | null): void {
    if (!iconElement) return;

    const pwInput = document.getElementById('pw') as HTMLInputElement;
    if (!pwInput) return;

    const match = input.value === pwInput.value && input.value.length > 0;

    iconElement.innerHTML = match 
      ? '<i class="fas fa-check-circle text-success"></i>'
      : '<i class="fas fa-times-circle text-danger"></i>';
  }

  // ============================================
  // VALIDACIÓN DE IDENTIFICADORES
  // ============================================
  setupIdentifierValidation(): void {
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const contactEmailInput = document.getElementById('contactEmail') as HTMLInputElement;
    const curpInput = document.getElementById('curp') as HTMLInputElement;
    const rfcInput = document.getElementById('rfc') as HTMLInputElement;

    // Email (sin validación de existencia - pendiente)
    if (emailInput) {
      emailInput.addEventListener('input', () => {
        this.updateIdentifierCount();
      });
    }

    // Contact Email
    if (contactEmailInput) {
      contactEmailInput.addEventListener('input', () => {
        this.validateEmail(contactEmailInput, 'contactEmail');
        this.updateIdentifierCount();
      });
    }

    // CURP
    if (curpInput) {
      curpInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        target.value = target.value.toUpperCase();
        this.validateCURP(curpInput);
        this.updateIdentifierCount();
      });
    }

    // RFC
    if (rfcInput) {
      rfcInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        target.value = target.value.toUpperCase();
        this.validateRFC(rfcInput);
        this.updateIdentifierCount();
      });
    }
  }

  validateEmail(input: HTMLInputElement, type: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(input.value);
    const iconElement = document.getElementById(`${type}Validation`);

    if (input.value.length === 0) {
      input.classList.remove('is-valid', 'is-invalid');
      if (iconElement) iconElement.innerHTML = '';
      return;
    }

    input.classList.toggle('is-valid', isValid);
    input.classList.toggle('is-invalid', !isValid);

    if (iconElement) {
      iconElement.innerHTML = isValid
        ? '<i class="fas fa-check-circle text-success"></i>'
        : '<i class="fas fa-times-circle text-danger"></i>';
    }
  }

  validateCURP(input: HTMLInputElement): void {
    const curp = input.value.trim();
    const isValid = curp.length === 18 && this.CURP_REGEX.test(curp);
    const iconElement = document.getElementById('curpValidation');

    if (curp.length === 0) {
      input.classList.remove('is-valid', 'is-invalid');
      if (iconElement) iconElement.innerHTML = '';
      return;
    }

    input.classList.toggle('is-valid', isValid);
    input.classList.toggle('is-invalid', !isValid && curp.length > 0);

    if (iconElement) {
      iconElement.innerHTML = isValid
        ? '<i class="fas fa-check-circle text-success"></i>'
        : '<i class="fas fa-times-circle text-danger"></i>';
    }
  }

  validateRFC(input: HTMLInputElement): void {
    const rfc = input.value.trim();
    const isValid = rfc.length === 13 && this.RFC_REGEX.test(rfc);
    const iconElement = document.getElementById('rfcValidation');

    if (rfc.length === 0) {
      input.classList.remove('is-valid', 'is-invalid');
      if (iconElement) iconElement.innerHTML = '';
      return;
    }

    input.classList.toggle('is-valid', isValid);
    input.classList.toggle('is-invalid', !isValid && rfc.length > 0);

    if (iconElement) {
      iconElement.innerHTML = isValid
        ? '<i class="fas fa-check-circle text-success"></i>'
        : '<i class="fas fa-times-circle text-danger"></i>';
    }
  }

  updateIdentifierCount(): void {
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const contactEmailInput = document.getElementById('contactEmail') as HTMLInputElement;
    const curpInput = document.getElementById('curp') as HTMLInputElement;
    const rfcInput = document.getElementById('rfc') as HTMLInputElement;
    const idHint = document.getElementById('idHint');

    let count = 0;

    // Email (solo formato, sin validación de existencia)
    if (emailInput && emailInput.value.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(emailInput.value)) {
        count++;
      }
    }

    // Contact Email
    if (contactEmailInput && contactEmailInput.classList.contains('is-valid')) {
      count++;
    }

    // CURP
    if (curpInput && curpInput.classList.contains('is-valid')) {
      count++;
    }

    // RFC
    if (rfcInput && rfcInput.classList.contains('is-valid')) {
      count++;
    }

    this.identifiersCount.set(count);

    if (idHint) {
      if (count >= 2) {
        idHint.innerHTML = `<i class="fas fa-check-circle me-2"></i><span>${count} identificadores válidos. Puedes continuar.</span>`;
        idHint.classList.remove('alert-warning');
        idHint.classList.add('alert-success');
      } else if (count === 1) {
        idHint.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i><span>1 identificador válido. Necesitas al menos 2 para continuar.</span>`;
        idHint.classList.remove('alert-success');
        idHint.classList.add('alert-warning');
      } else {
        idHint.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i><span>Proporciona al menos dos identificadores válidos.</span>`;
        idHint.classList.remove('alert-success');
        idHint.classList.add('alert-warning');
      }
    }

    this.updateSubmitButton();
  }

  // ============================================
  // VALIDACIÓN DEL FORMULARIO
  // ============================================
  setupFormValidation(): void {
    const form = document.getElementById('resetForm') as HTMLFormElement;
    const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;

    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.isFormValid()) {
          this.submitResetPassword();
        } else {
          this.showFormErrors();
        }
      });
    }

    // Validar en tiempo real
    const inputs = form?.querySelectorAll('input, select');
    inputs?.forEach(input => {
      input.addEventListener('blur', () => {
        this.updateSubmitButton();
      });
    });
  }

  submitResetPassword(): void {
    if (this.submitting()) return;

    const emailInput = document.getElementById('email') as HTMLInputElement;
    const contactEmailInput = document.getElementById('contactEmail') as HTMLInputElement;
    const curpInput = document.getElementById('curp') as HTMLInputElement;
    const rfcInput = document.getElementById('rfc') as HTMLInputElement;
    const pwInput = document.getElementById('pw') as HTMLInputElement;

    const email = emailInput?.value.trim() || contactEmailInput?.value.trim() || null;
    const curp = curpInput?.value.trim().toUpperCase() || null;
    const rfc = rfcInput?.value.trim().toUpperCase() || null;
    const newPassword = pwInput?.value || '';

    // Validar que tenga al menos 2 identificadores
    let identifierCount = 0;
    if (email) identifierCount++;
    if (curp && curp.length === 18 && this.CURP_REGEX.test(curp)) identifierCount++;
    if (rfc && rfc.length === 13 && this.RFC_REGEX.test(rfc)) identifierCount++;

    if (identifierCount < 2) {
      Swal.fire({
        icon: 'error',
        title: 'Error de validación',
        text: 'Debes proporcionar al menos 2 identificadores válidos (email, CURP o RFC)',
        confirmButtonColor: '#8B1538'
      });
      return;
    }

    this.submitting.set(true);

    Swal.fire({
      title: 'Cambiando contraseña...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const payload = {
      email: email,
      curp: curp,
      rfc: rfc,
      newPassword: newPassword
    };

    this.http.post<{success: boolean, message: string}>(`${environment.apiBaseUrl}/auth/reset-password`, payload)
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          Swal.fire({
            icon: 'success',
            title: '¡Contraseña actualizada!',
            text: 'Tu contraseña ha sido cambiada correctamente. Por favor, inicia sesión con tu nueva contraseña.',
            confirmButtonColor: '#8B1538'
          }).then(() => {
            this.router.navigate(['/login']);
          });
        },
        error: (err) => {
          this.submitting.set(false);
          console.error('Error al cambiar contraseña:', err);
          
          let errorMessage = 'No se pudo cambiar la contraseña. Por favor, intente nuevamente.';
          
          if (err?.error?.message) {
            errorMessage = err.error.message;
          } else if (err?.error?.detail) {
            errorMessage = err.error.detail;
          } else if (typeof err?.error === 'string') {
            errorMessage = err.error;
          }

          Swal.fire({
            icon: 'error',
            title: 'Error al cambiar contraseña',
            html: errorMessage.replace(/\n/g, '<br>'),
            confirmButtonColor: '#8B1538',
            width: '600px'
          });
        }
      });
  }

  isFormValid(): boolean {
    const contactEmailInput = document.getElementById('contactEmail') as HTMLInputElement;
    const pwInput = document.getElementById('pw') as HTMLInputElement;
    const pw2Input = document.getElementById('pw2') as HTMLInputElement;

    const hasValidIdentifiers = this.identifiersCount() >= 2;
    const hasValidPassword = pwInput && pwInput.value.length >= 8 && 
                            /[A-Z]/.test(pwInput.value) && 
                            /[a-z]/.test(pwInput.value) && 
                            /\d/.test(pwInput.value);
    const passwordsMatch = this.passwordsMatch();

    return hasValidIdentifiers && hasValidPassword === true && passwordsMatch;
  }

  updateSubmitButton(): void {
    const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
    if (submitBtn) {
      submitBtn.disabled = !this.isFormValid();
    }
  }

  showFormErrors(): void {
    const formStatus = document.getElementById('formStatus');
    if (formStatus) {
      formStatus.innerHTML = `
        <div class="alert alert-danger d-flex align-items-center" role="alert">
          <i class="fas fa-exclamation-circle me-2"></i>
          <div>
            <strong>Error:</strong> Por favor, completa todos los campos requeridos correctamente.
            <ul class="mb-0 mt-2">
              ${this.identifiersCount() < 2 ? '<li>Necesitas al menos 2 identificadores válidos</li>' : ''}
              ${!this.isPasswordValid() ? '<li>La contraseña no cumple con los requisitos</li>' : ''}
              ${!this.passwordsMatch() ? '<li>Las contraseñas no coinciden</li>' : ''}
            </ul>
          </div>
        </div>
      `;
    }
  }

  isPasswordValid(): boolean {
    const pwInput = document.getElementById('pw') as HTMLInputElement;
    if (!pwInput) return false;
    
    const password = pwInput.value;
    return password.length >= 8 && 
           /[A-Z]/.test(password) && 
           /[a-z]/.test(password) && 
           /\d/.test(password);
  }
}
