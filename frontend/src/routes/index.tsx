import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { CampaignsPage } from '../pages/CampaignsPage';
import { CampaignDetailPage } from '../pages/CampaignDetailPage';
import { DraftsPage } from '../pages/DraftsPage';
import { DraftWorkspacePage } from '../pages/DraftWorkspacePage';
import { CompaniesPage } from '../pages/CompaniesPage';
import { CompanyDetailPage } from '../pages/CompanyDetailPage';
import { ResumesPage } from '../pages/ResumesPage';
import { ResumeDetailPage } from '../pages/ResumeDetailPage';
import { GmailPage } from '../pages/GmailPage';
import { SettingsPage } from '../pages/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/campaigns" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'campaigns',
        element: <CampaignsPage />,
      },
      {
        path: 'campaigns/:id',
        element: <CampaignDetailPage />,
      },
      {
        path: 'drafts',
        element: <DraftsPage />,
      },
      {
        path: 'drafts/:id',
        element: <DraftWorkspacePage />,
      },
      {
        path: 'companies',
        element: <CompaniesPage />,
      },
      {
        path: 'companies/:id',
        element: <CompanyDetailPage />,
      },
      {
        path: 'resumes',
        element: <ResumesPage />,
      },
      {
        path: 'resumes/:id',
        element: <ResumeDetailPage />,
      },
      {
        path: 'gmail',
        element: <GmailPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: <Navigate to="/campaigns" replace />,
      },
    ],
  },
]);
