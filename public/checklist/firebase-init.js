let firebaseReady = false;
let useLocalStorage = false;

if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
  if (firebaseConfig.projectId && firebaseConfig.projectId !== 'SEU_PROJETO_ID') {
    firebase.initializeApp(firebaseConfig);
    firebaseReady = true;
  } else {
    useLocalStorage = true;
  }
} else {
  useLocalStorage = true;
}
