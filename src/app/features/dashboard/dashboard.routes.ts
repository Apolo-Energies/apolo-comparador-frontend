import { Routes } from "@angular/router";
import { Comparator } from "./pages/comparator/comparator";
import { Layout } from "../layout/layout";

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: '', redirectTo: 'comparator', pathMatch: 'full' },
      { path: 'comparator', component: Comparator },
    ]
  }
];
