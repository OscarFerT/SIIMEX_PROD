import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistroStep2Component } from './registro-step2';

describe('RegistroStep2', () => {
  let component: RegistroStep2Component;
  let fixture: ComponentFixture<RegistroStep2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistroStep2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistroStep2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
