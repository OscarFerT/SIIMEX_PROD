import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  me: any;
  constructor(private auth: AuthService) {}
  loadMe() { this.auth.me().subscribe(data => this.me = data); }
  logout() { this.auth.logout(); location.href = '/login'; }

}
