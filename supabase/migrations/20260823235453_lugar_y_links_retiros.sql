-- Universalizar más valores que estaban hardcodeados en el código:
-- el lugar del retiro y los links de formulario de inscripción / manual,
-- que cambian de una edición del retiro a otra.

alter table retiros
  add column if not exists lugar text not null default 'Casa Santa Luisa Los Pinares',
  add column if not exists link_formulario text not null default 'https://docs.google.com/forms/d/1jLFD4BZingfwg_-OKGY0DYokFqMH-9eQr8GqlSAGuTM',
  add column if not exists link_manual text not null default 'https://docs.google.com/document/d/1lB2M0-FyRe6Eu-2HjcLcnI96jfEqgikC71TWzuhNUR4/edit';

comment on column retiros.lugar is 'Casa/lugar donde se realiza este retiro.';
comment on column retiros.link_formulario is 'Link del Google Form de inscripción para este retiro.';
comment on column retiros.link_manual is 'Link del Manual (Google Doc) de este retiro.';
