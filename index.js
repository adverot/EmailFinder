import { ping, SmtpPingStatus } from 'smtp-ping';

ping('test@mail.com', { timeout: 5000 })
  .then(result => console.log(result))
  .catch(error => console.error(error));