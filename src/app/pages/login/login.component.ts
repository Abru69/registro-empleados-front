import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, LoginResponse } from '@core/services/auth.service';
import { ToastService } from '@shared/components/toast/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  usuario = '';
  password = '';
  isLoading = false;
  showPassword = false;

  constructor(
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router
  ) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (!this.usuario.trim() || !this.password.trim()) {
      this.toastService.error('Por favor, completa todos los campos');
      return;
    }

    this.isLoading = true;

    this.authService.login(this.usuario.trim(), this.password).subscribe({
      next: (response: LoginResponse) => {
        this.isLoading = false;
        if (response.status === 'ok') {
          this.toastService.success(`¡Bienvenido, ${response.usuario}!`);
          const dest = response.rol === 'admin' ? '/dashboard' : '/attendance';
          this.router.navigate([dest]);
        } else {
          this.toastService.error(response.mensaje || 'Credenciales incorrectas');
        }
      },
      error: (_err: unknown) => {
        this.isLoading = false;
        this.toastService.error('Error de conexión con el servidor');
      }
    });
  }
}
