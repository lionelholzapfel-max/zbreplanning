export interface Member {
  id: string;
  name: string;
  slug: string;
  photo: string;
}

export const MEMBERS: Member[] = [
  { id: "1", name: "Benjamin Oyowe", slug: "benjamin-oyowe", photo: "/members/benjamin-oyowe.png" },
  { id: "2", name: "Edu Rodger Martinez", slug: "edu-rodger-martinez", photo: "/members/edu-rodger-martinez.png" },
  { id: "3", name: "Gregory Longueville", slug: "gregory-longueville", photo: "/members/gregory-longueville.png" },
  { id: "4", name: "Ian Poznanski", slug: "ian-poznanski", photo: "/members/ian-poznanski.png" },
  { id: "5", name: "Kevin Nounomo", slug: "kevin-nounomo", photo: "/members/kevin-nounomo.png" },
  { id: "6", name: "Killian Bohan", slug: "killian-bohan", photo: "/members/killian-bohan.png" },
  { id: "7", name: "Lionel Holzapfel", slug: "lionel-holzapfel", photo: "/members/lionel-holzapfel.png" },
  { id: "8", name: "Martin Bracken", slug: "martin-bracken", photo: "/members/martin-bracken.png" },
  { id: "9", name: "Maximilien Piquet", slug: "maximilien-piquet", photo: "/members/maximilien-piquet.png" },
  { id: "10", name: "Nicolas Reuter", slug: "nicolas-reuter", photo: "/members/nicolas-reuter.png" },
  { id: "11", name: "Ramzi Lahouegue", slug: "ramzi-lahouegue", photo: "/members/ramzi-lahouegue.png" },
  { id: "12", name: "Ruairi Doyle", slug: "ruairi-doyle", photo: "/members/ruairi-doyle.png" },
  { id: "13", name: "Sacha Convens", slug: "sacha-convens", photo: "/members/sacha-convens.png" },
  { id: "14", name: "Sam Spinnael", slug: "sam-spinnael", photo: "/members/sam-spinnael.png" },
];

export const getMemberBySlug = (slug: string) => MEMBERS.find(m => m.slug === slug);
export const getMemberById = (id: string) => MEMBERS.find(m => m.id === id);
