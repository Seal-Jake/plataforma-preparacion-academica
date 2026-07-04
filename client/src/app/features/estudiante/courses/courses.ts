import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoursesService } from '../../../core/services/courses.service';
import { Course } from '../../../core/models/models';
import { Icon } from '../../../shared/components/icon/icon';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'app-courses-list',
  imports: [RouterLink, Icon, EmptyState],
  templateUrl: './courses.html',
  styleUrl: './courses.css',
})
export class CoursesList implements OnInit {
  courses = signal<Course[]>([]);

  constructor(private coursesSvc: CoursesService) {}

  ngOnInit() {
    this.coursesSvc.list().subscribe((c) => this.courses.set(c));
  }
}
