import sayHi from './utils/sayHi';

document.addEventListener('DOMContentLoaded', () => {
  let name = prompt('What is your name?');
  sayHi(name);
});
