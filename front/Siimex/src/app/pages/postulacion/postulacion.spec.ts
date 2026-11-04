import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { PostulacionComponent } from './postulacion';

describe('Postulacion', () => {
  let component: PostulacionComponent;
  let fixture: ComponentFixture<PostulacionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostulacionComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PostulacionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
