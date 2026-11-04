import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { TrayectoriaComponent } from './trayectoria';

describe('Trayectoria', () => {
  let component: TrayectoriaComponent;
  let fixture: ComponentFixture<TrayectoriaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrayectoriaComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrayectoriaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
