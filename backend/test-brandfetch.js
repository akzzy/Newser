const url = "https://cdn.brandfetch.io/idCJH55bvk/w/400/h/400/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1725515159618";

fetch(url, {
  headers: {
    "Referer": "http://localhost:3000/"
  }
}).then(res => {
  console.log("Status:", res.status);
  console.log("Headers:", res.headers);
});
