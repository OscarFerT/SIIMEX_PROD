import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PostulacionComponent } from './postulacion';

describe('Postulacion', () => {
  let component: PostulacionComponent;
  let fixture: ComponentFixture<PostulacionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostulacionComponent]
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
