const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('pages/IndexPage.vue')
      },
      {
        path: 'search',
        component: () => import('pages/SearchPage.vue')
      },
      {
        path: 'notifications',
        component: () => import('pages/NotificationsPage.vue')
      },
      {
        path: 'profile',
        component: () => import('pages/ProfilePage.vue')
      }
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('app/src/pages/404Error.vue')
  }
]

export default routes
