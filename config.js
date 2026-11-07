/* Delicatta Cristã — configuração do Firebase (site + painel)
   O catálogo mora em /catalogo no Realtime Database. O site lê daqui; se o
   banco estiver vazio ou bloqueado, ele cai de volta para produtos.json. */

window.DELICATTA = {
  databaseURL: 'https://teste-67ee5-default-rtdb.firebaseio.com',
  catalogPath: 'catalogo',
};

/* Configuração completa do app (para quando o SDK for usado no futuro) */
window.DELICATTA.firebaseConfig = {
  apiKey: 'AIzaSyBqkdS6pHnDs2gJnEVXliMNLfssS5C7EuA',
  authDomain: 'teste-67ee5.firebaseapp.com',
  databaseURL: 'https://teste-67ee5-default-rtdb.firebaseio.com',
  projectId: 'teste-67ee5',
  storageBucket: 'teste-67ee5.firebasestorage.app',
  messagingSenderId: '374329071759',
  appId: '1:374329071759:web:610fa44bc6395b8895f8fa',
  measurementId: 'G-56FW18HP7K',
};
