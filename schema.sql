--
-- PostgreSQL database dump
--

\restrict xnovb6acKhRTSEVm7baLgyzs1lepJXg1FzftahwQvTg8JhdJZeh3MZj6v7HKUM4

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

-- Started on 2026-04-29 14:59:07

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 224 (class 1259 OID 16428)
-- Name: analytics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analytics (
    analytics_id integer NOT NULL,
    account_id integer NOT NULL,
    followers integer,
    following integer,
    likes integer,
    comments integer,
    shares integer,
    impressions integer,
    reach integer,
    engagement_rate numeric(5,2),
    analytics_data jsonb NOT NULL,
    collected_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.analytics OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16427)
-- Name: analytics_analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.analytics_analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.analytics_analytics_id_seq OWNER TO postgres;

--
-- TOC entry 5053 (class 0 OID 0)
-- Dependencies: 223
-- Name: analytics_analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.analytics_analytics_id_seq OWNED BY public.analytics.analytics_id;


--
-- TOC entry 226 (class 1259 OID 16446)
-- Name: post; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post (
    post_id integer NOT NULL,
    user_id integer NOT NULL,
    account_id integer NOT NULL,
    platform_post_id character varying(100),
    content text NOT NULL,
    image_url character varying(255),
    video_url character varying(255),
    publish_date timestamp without time zone,
    post_type character varying(20),
    post_data jsonb
);


ALTER TABLE public.post OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16445)
-- Name: post_post_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.post_post_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.post_post_id_seq OWNER TO postgres;

--
-- TOC entry 5054 (class 0 OID 0)
-- Dependencies: 225
-- Name: post_post_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.post_post_id_seq OWNED BY public.post.post_id;


--
-- TOC entry 222 (class 1259 OID 16406)
-- Name: social_account; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.social_account (
    account_id integer NOT NULL,
    user_id integer NOT NULL,
    platform character varying(50) NOT NULL,
    account_handle character varying(100),
    account_name character varying(100),
    profile_picture_url character varying(255),
    access_token text NOT NULL,
    refresh_token text,
    token_expiry timestamp without time zone,
    is_connected boolean DEFAULT true,
    platform_data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.social_account OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16405)
-- Name: social_account_account_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.social_account_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.social_account_account_id_seq OWNER TO postgres;

--
-- TOC entry 5055 (class 0 OID 0)
-- Dependencies: 221
-- Name: social_account_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.social_account_account_id_seq OWNED BY public.social_account.account_id;


--
-- TOC entry 220 (class 1259 OID 16389)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'user'::character varying,
    avatar_url character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    interests text[]
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16388)
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_user_id_seq OWNER TO postgres;

--
-- TOC entry 5056 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- TOC entry 4878 (class 2604 OID 16431)
-- Name: analytics analytics_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics ALTER COLUMN analytics_id SET DEFAULT nextval('public.analytics_analytics_id_seq'::regclass);


--
-- TOC entry 4880 (class 2604 OID 16449)
-- Name: post post_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post ALTER COLUMN post_id SET DEFAULT nextval('public.post_post_id_seq'::regclass);


--
-- TOC entry 4874 (class 2604 OID 16409)
-- Name: social_account account_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_account ALTER COLUMN account_id SET DEFAULT nextval('public.social_account_account_id_seq'::regclass);


--
-- TOC entry 4871 (class 2604 OID 16392)
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- TOC entry 4891 (class 2606 OID 16439)
-- Name: analytics analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics
    ADD CONSTRAINT analytics_pkey PRIMARY KEY (analytics_id);


--
-- TOC entry 4896 (class 2606 OID 16457)
-- Name: post post_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post
    ADD CONSTRAINT post_pkey PRIMARY KEY (post_id);


--
-- TOC entry 4887 (class 2606 OID 16419)
-- Name: social_account social_account_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_account
    ADD CONSTRAINT social_account_pkey PRIMARY KEY (account_id);


--
-- TOC entry 4889 (class 2606 OID 16421)
-- Name: social_account social_account_user_id_platform_account_handle_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_account
    ADD CONSTRAINT social_account_user_id_platform_account_handle_key UNIQUE (user_id, platform, account_handle);


--
-- TOC entry 4882 (class 2606 OID 16404)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4884 (class 2606 OID 16402)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 4892 (class 1259 OID 16486)
-- Name: idx_analytics_account_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analytics_account_date ON public.analytics USING btree (account_id, collected_date DESC);


--
-- TOC entry 4893 (class 1259 OID 16487)
-- Name: idx_analytics_data; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analytics_data ON public.analytics USING gin (analytics_data);


--
-- TOC entry 4894 (class 1259 OID 16488)
-- Name: idx_posts_account_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_posts_account_date ON public.post USING btree (account_id, publish_date DESC);


--
-- TOC entry 4885 (class 1259 OID 16485)
-- Name: idx_social_account_user_platform; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_social_account_user_platform ON public.social_account USING btree (user_id, platform);


--
-- TOC entry 4898 (class 2606 OID 16440)
-- Name: analytics analytics_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics
    ADD CONSTRAINT analytics_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.social_account(account_id);


--
-- TOC entry 4899 (class 2606 OID 16463)
-- Name: post post_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post
    ADD CONSTRAINT post_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.social_account(account_id);


--
-- TOC entry 4900 (class 2606 OID 16458)
-- Name: post post_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post
    ADD CONSTRAINT post_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- TOC entry 4897 (class 2606 OID 16422)
-- Name: social_account social_account_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_account
    ADD CONSTRAINT social_account_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


-- Completed on 2026-04-29 14:59:07

--
-- PostgreSQL database dump complete
--

\unrestrict xnovb6acKhRTSEVm7baLgyzs1lepJXg1FzftahwQvTg8JhdJZeh3MZj6v7HKUM4

