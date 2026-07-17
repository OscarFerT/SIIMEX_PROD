import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent {
  menuOpen = false;

  constructor(public auth: AuthService, private router: Router) {}

  toggleMenu() { this.menuOpen = !this.menuOpen; }

  goToPerfil() {
    this.router.navigateByUrl('/app/acerca-de/perfil');
    this.menuOpen = false;
  }

  logout() {
  this.auth.logout();
  this.menuOpen = false;
  this.router.navigateByUrl('/'); // ✅ landing
}

}
