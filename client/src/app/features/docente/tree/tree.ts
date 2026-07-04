import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CoursesService } from '../../../core/services/courses.service';
import { Course } from '../../../core/models/models';
import { Icon } from '../../../shared/components/icon/icon';

@Component({
  selector: 'app-tree',
  imports: [RouterLink, ReactiveFormsModule, Icon],
  templateUrl: './tree.html',
  styleUrl: './tree.css',
})
export class Tree implements OnInit {
  private courseSvc = inject(CoursesService);
  private fb = inject(FormBuilder);

  courses = signal<Course[]>([]);
  expandedUnits = signal<Set<string>>(new Set());
  addingUnitToCourse = signal<string | null>(null);
  addingTopicToUnit = signal<string | null>(null);

  unitForm = this.fb.group({ name: ['', Validators.required] });
  topicForm = this.fb.group({ name: ['', Validators.required], subtemas: [''] });

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.courseSvc.list().subscribe((courses) => this.courses.set(courses));
  }

  toggleUnit(unitId: string) {
    const set = new Set(this.expandedUnits());
    if (set.has(unitId)) set.delete(unitId);
    else set.add(unitId);
    this.expandedUnits.set(set);
  }

  isExpanded(unitId: string) {
    return this.expandedUnits().has(unitId);
  }

  startAddUnit(courseId: string) {
    this.addingUnitToCourse.set(courseId);
    this.unitForm.reset();
  }

  saveUnit(courseId: string) {
    if (this.unitForm.invalid) return;
    this.courseSvc
      .createUnit({ courseId, name: this.unitForm.value.name! })
      .subscribe(() => {
        this.addingUnitToCourse.set(null);
        this.reload();
      });
  }

  startAddTopic(unitId: string) {
    this.addingTopicToUnit.set(unitId);
    this.topicForm.reset();
  }

  saveTopic(unitId: string) {
    if (this.topicForm.invalid) return;
    this.courseSvc
      .createTopic({ unitId, name: this.topicForm.value.name!, subtemas: this.topicForm.value.subtemas || undefined })
      .subscribe(() => {
        this.addingTopicToUnit.set(null);
        this.reload();
      });
  }
}
